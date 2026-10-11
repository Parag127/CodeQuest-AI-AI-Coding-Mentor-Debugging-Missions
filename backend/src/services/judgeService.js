/**
 * Judge0 Code Execution Service & Adapter
 * Handles code submission to Judge0 CE / RapidAPI, asynchronous polling,
 * status mapping, timeout/memory limits, authentication, and safe offline mock simulation.
 * 
 * Adheres strictly to CodeDNA SECURITY.md & SYSTEM_DESIGN.md specifications:
 * - Never executes untrusted learner code in the Express process.
 * - Enforces wall-clock, CPU, and memory limits via the isolated runner.
 * - Protects hidden test inputs and expected outputs.
 */
import vm from 'node:vm';

// Judge0 Language IDs
export const LANGUAGE_IDS = {
  javascript: parseInt(process.env.JUDGE0_LANG_JS || '93', 10), // Node.js 18.15.0 (or 102 for Node 20)
  java: parseInt(process.env.JUDGE0_LANG_JAVA || '91', 10)       // OpenJDK 17.0.6 (or 103 for OpenJDK 21)
};

// Internal Status Enum (Adheres to API_CONTRACT.md & SYSTEM_DESIGN.md)
export const STATUS = {
  PASSED: 'passed',
  WRONG_OUTPUT: 'wrong_output',
  TIMEOUT: 'timeout',
  COMPILE_ERROR: 'compile_error',
  RUNTIME_ERROR: 'runtime_error',
  INTERNAL_ERROR: 'internal_error'
};

/**
 * Maps Judge0 Status ID to internal status enum.
 * 
 * Judge0 Status IDs:
 * 1: In Queue (Pending)
 * 2: Processing (Pending)
 * 3: Accepted -> 'passed'
 * 4: Wrong Answer -> 'wrong_output'
 * 5: Time Limit Exceeded -> 'timeout'
 * 6: Compilation Error -> 'compile_error'
 * 7: Runtime Error (SIGSEGV) -> 'runtime_error'
 * 8: Runtime Error (SIGXFSZ) -> 'runtime_error'
 * 9: Runtime Error (SIGFPE) -> 'runtime_error'
 * 10: Runtime Error (SIGABRT) -> 'runtime_error'
 * 11: Runtime Error (NZEC) -> 'runtime_error'
 * 12: Runtime Error (Other) -> 'runtime_error'
 * 13: Internal Error -> 'internal_error'
 * 14: Exec Format Error -> 'internal_error'
 */
export function mapJudgeStatus(statusId) {
  switch (Number(statusId)) {
    case 3:
      return STATUS.PASSED;
    case 4:
      return STATUS.WRONG_OUTPUT;
    case 5:
      return STATUS.TIMEOUT;
    case 6:
      return STATUS.COMPILE_ERROR;
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return STATUS.RUNTIME_ERROR;
    case 13:
    case 14:
      return STATUS.INTERNAL_ERROR;
    default:
      return STATUS.INTERNAL_ERROR;
  }
}

/**
 * Normalizes stdout/expectedOutput for whitespace and line-ending parity.
 */
export function normalizeOutput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trimEnd();
}

/**
 * Prepares and sanitizes Java source code for Judge0 execution.
 * Ensures the class name matches Main as required by Judge0 OpenJDK runner.
 */
export function prepareJavaCode(code) {
  if (!code || typeof code !== 'string') return '';
  const trimmed = code.trim();

  // If already defines a class, replace public class <Name> with public class Main
  if (/class\s+\w+/i.test(trimmed)) {
    return trimmed.replace(/public\s+class\s+([A-Za-z0-9_]+)/g, (match, className) => {
      return className === 'Main' ? match : 'public class Main';
    });
  }

  // If learner only wrote class body or methods, wrap inside public class Main
  return `import java.util.*;
import java.io.*;

public class Main {
    ${trimmed}
}`;
}

/**
 * Checks whether an execution runner is configured.
 */
export function isRunnerConfigured() {
  const apiUrl = process.env.JUDGE0_API_URL;
  const isMock = process.env.JUDGE0_MOCK_RUNNER === 'true';
  return Boolean(apiUrl || isMock);
}

/**
 * Builds HTTP request headers for Judge0 API calls based on configured credentials.
 */
export function buildJudgeHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  // RapidAPI hosted instance authentication
  if (process.env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';
  }

  // Self-hosted Judge0 CE authentication
  if (process.env.JUDGE0_AUTH_TOKEN) {
    headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
  }

  return headers;
}

/**
 * Polls for submission completion when execution is asynchronous or queued.
 * 
 * @param {string} apiUrl - Base Judge0 API URL
 * @param {string} token - Submission tracking token
 * @param {Object} headers - HTTP request headers
 * @param {number} [maxWaitMs=12000] - Maximum wall-clock time in ms to poll
 * @param {number} [pollIntervalMs=350] - Interval in ms between status checks
 * @returns {Promise<Object>} Completed submission object from Judge0
 */
export async function pollSubmissionResult(apiUrl, token, headers, maxWaitMs = 12000, pollIntervalMs = 350) {
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/submissions/${encodeURIComponent(token)}?base64_encoded=false`;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Wait before poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
    } catch (pollErr) {
      // Transient network hiccup during poll; continue until deadline
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        const err = new Error('Judge0 code runner rate limit exceeded during polling');
        err.code = 'RUNNER_RATE_LIMITED';
        err.statusCode = 429;
        throw err;
      }
      continue;
    }

    let result;
    try {
      result = await response.json();
    } catch {
      continue;
    }

    const statusId = result.status?.id;
    // Status IDs >= 3 are terminal (Accepted, Wrong Answer, TLE, CE, RE, etc.)
    if (statusId && Number(statusId) >= 3) {
      return result;
    }
  }

  // Polling exceeded maximum wall-clock timeout budget
  return {
    status: {
      id: 5,
      description: 'Time Limit Exceeded (Polling Timeout)'
    },
    stdout: null,
    stderr: 'Execution timed out waiting for runner completion',
    time: (maxWaitMs / 1000).toFixed(3),
    memory: null
  };
}

/**
 * Dispatches a code submission to Judge0 CE or the safe mock runner.
 * 
 * @param {Object} params
 * @param {string} params.language - 'javascript' or 'java'
 * @param {string} params.code - Source code to execute
 * @param {string} [params.stdin] - Standard input provided to the program
 * @param {string} [params.expectedOutput] - Expected output to compare against
 * @returns {Promise<Object>} Execution result with mapped status
 */
export async function executeSubmission({ language, code, stdin = '', expectedOutput = null }) {
  if (!language || !['javascript', 'java'].includes(language)) {
    throw new Error(`Unsupported language '${language}'. Supported languages: 'javascript', 'java'`);
  }

  if (!code || typeof code !== 'string') {
    throw new Error('Code must be a non-empty string');
  }

  // 1. If mock runner is active, execute via safe offline simulation
  if (process.env.JUDGE0_MOCK_RUNNER === 'true') {
    return executeMockSubmission({ language, code, stdin, expectedOutput });
  }

  // 2. If no runner is configured, return error per API_CONTRACT.md
  const apiUrl = process.env.JUDGE0_API_URL;
  if (!apiUrl) {
    const error = new Error('Code execution is not configured. The submission was not executed.');
    error.code = 'RUNNER_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  // 3. Prepare code and language ID
  const languageId = LANGUAGE_IDS[language];
  const sourceCode = language === 'java' ? prepareJavaCode(code) : code;

  // Strict resource limits as required by SECURITY.md
  const requestBody = {
    source_code: sourceCode,
    language_id: languageId,
    stdin: stdin || '',
    expected_output: expectedOutput !== null ? expectedOutput : undefined,
    cpu_time_limit: parseFloat(process.env.JUDGE0_CPU_TIME_LIMIT || '5'),
    wall_time_limit: parseFloat(process.env.JUDGE0_WALL_TIME_LIMIT || '10'),
    memory_limit: parseInt(process.env.JUDGE0_MEMORY_LIMIT || '131072', 10), // 128 MB cap
    max_file_size: parseInt(process.env.JUDGE0_MAX_FILE_SIZE || '1024', 10), // 1 MB output cap
    enable_network: false
  };

  const headers = buildJudgeHeaders();
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/submissions?base64_encoded=false&wait=true`;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (fetchErr) {
    const err = new Error(`Failed to contact Judge0 runner: ${fetchErr.message}`);
    err.code = 'RUNNER_UNAVAILABLE';
    err.statusCode = 503;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  // Handle provider authentication errors
  if (response.status === 401 || response.status === 403) {
    const err = new Error('Authentication failed for code runner provider (invalid or missing credentials)');
    err.code = 'RUNNER_AUTH_ERROR';
    err.statusCode = 503;
    throw err;
  }

  // Handle provider rate limits
  if (response.status === 429) {
    const err = new Error('Judge0 code runner rate limit exceeded. Please retry shortly.');
    err.code = 'RUNNER_RATE_LIMITED';
    err.statusCode = 429;
    throw err;
  }

  // Handle other provider HTTP errors
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Judge0 responded with status ${response.status}`);
    err.details = errText;
    err.code = 'RUNNER_ERROR';
    err.statusCode = 503;
    throw err;
  }

  let judgeResult;
  try {
    judgeResult = await response.json();
  } catch (jsonErr) {
    const err = new Error('Malformed JSON received from Judge0 runner');
    err.code = 'RUNNER_MALFORMED_RESPONSE';
    err.statusCode = 502;
    throw err;
  }

  // If Judge0 queued the job or returned without terminal status, poll asynchronously
  const initialStatusId = judgeResult.status?.id;
  if (!initialStatusId || Number(initialStatusId) < 3) {
    if (judgeResult.token) {
      judgeResult = await pollSubmissionResult(apiUrl, judgeResult.token, headers);
    }
  }

  const rawStatusId = judgeResult.status ? judgeResult.status.id : 13;
  let internalStatus = mapJudgeStatus(rawStatusId);

  // Cross-verify stdout vs expectedOutput if expectedOutput was provided
  const stdout = judgeResult.stdout || '';
  const stderr = judgeResult.stderr || judgeResult.compile_output || '';

  if (internalStatus === STATUS.PASSED && expectedOutput !== null) {
    const normOut = normalizeOutput(stdout);
    const normExp = normalizeOutput(expectedOutput);
    if (normOut !== normExp) {
      internalStatus = STATUS.WRONG_OUTPUT;
    }
  }

  return {
    status: internalStatus,
    judgeStatusId: rawStatusId,
    judgeStatusDescription: judgeResult.status?.description || 'Unknown',
    stdout: stdout ? stdout : null,
    stderr: stderr ? stderr : null,
    timeMs: judgeResult.time ? Math.round(parseFloat(judgeResult.time) * 1000) : null,
    memoryKb: judgeResult.memory ? parseInt(judgeResult.memory, 10) : null
  };
}

/**
 * Deterministic mock runner for offline development, local unit tests,
 * and fallback testing when JUDGE0_MOCK_RUNNER=true.
 */
export function executeMockSubmission({ language, code, stdin = '', expectedOutput = null }) {
  // 1. Syntax / Compilation error simulation & static AST analysis
  if (code.includes('syntax_error_test') || code.includes('SYNTAX_ERROR')) {
    return {
      status: STATUS.COMPILE_ERROR,
      judgeStatusId: 6,
      judgeStatusDescription: 'Compilation Error',
      stdout: null,
      stderr: language === 'java' ? 'Main.java:3: error: \';\' expected' : 'SyntaxError: Unexpected token',
      timeMs: 12,
      memoryKb: 1024
    };
  }

  // Real static syntax analysis for JavaScript (AST parse without executing untrusted learner code)
  if (language === 'javascript') {
    try {
      new vm.Script(code);
    } catch (syntaxErr) {
      const errLines = (syntaxErr.stack || syntaxErr.message).split('\n');
      const cleanErr = errLines.slice(0, 3).join('\n');
      return {
        status: STATUS.COMPILE_ERROR,
        judgeStatusId: 6,
        judgeStatusDescription: 'Compilation Error',
        stdout: null,
        stderr: cleanErr || syntaxErr.message,
        timeMs: 8,
        memoryKb: 1024
      };
    }
  }

  // Real basic syntax checking for Java
  if (language === 'java') {
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openBraces !== closeBraces || openParens !== closeParens) {
      return {
        status: STATUS.COMPILE_ERROR,
        judgeStatusId: 6,
        judgeStatusDescription: 'Compilation Error',
        stdout: null,
        stderr: openBraces !== closeBraces
          ? `Main.java: error: reached end of file while parsing (unmatched braces: ${openBraces} '{' vs ${closeBraces} '}')`
          : 'Main.java: error: unmatched parentheses in statement',
        timeMs: 10,
        memoryKb: 1024
      };
    }
  }

  // 2. Timeout simulation
  if (code.includes('timeout_test') || code.includes('while(true)') || code.includes('while (true)')) {
    return {
      status: STATUS.TIMEOUT,
      judgeStatusId: 5,
      judgeStatusDescription: 'Time Limit Exceeded',
      stdout: null,
      stderr: 'Time limit exceeded',
      timeMs: 5000,
      memoryKb: 2048
    };
  }

  // 3. Runtime error simulation
  if (code.includes('runtime_error_test') || code.includes('throw new Error') || code.includes('NullPointerException')) {
    return {
      status: STATUS.RUNTIME_ERROR,
      judgeStatusId: 11,
      judgeStatusDescription: 'Runtime Error',
      stdout: null,
      stderr: language === 'java' 
        ? 'Exception in thread "main" java.lang.NullPointerException\n\tat Main.main(Main.java:5)' 
        : 'TypeError: Cannot read properties of undefined (reading \'length\')',
      timeMs: 20,
      memoryKb: 1024
    };
  }

  // 4. Output evaluation
  let simulatedStdout = '';

  // Hello World check
  if (code.includes('hello_world_correct')) {
    simulatedStdout = 'Hello World\n';
  } else if (code.includes('hello_world_wrong')) {
    simulatedStdout = 'Goodbye World\n';
  } else if (code.includes('reverse-string') || code.includes('reverseString') || code.includes('solution(str)')) {
    // Reverse string logic simulation
    if (code.includes('str.split(\'\').reverse().join(\'\')') || code.includes('reverse()') || code.includes('StringBuilder') && code.includes('reverse')) {
      simulatedStdout = stdin.trim().split('').reverse().join('') + '\n';
    } else {
      // Unmodified starter code returns input as-is (wrong for reversal)
      simulatedStdout = stdin.trim() + '\n';
    }
  } else if (code.includes('findLargest') || code.includes('largest-number')) {
    // Largest number logic simulation
    const allNums = (stdin.match(/-?\d+/g) || []).map(Number);
    const numbers = allNums.length > 1 ? allNums.slice(1) : allNums;
    if (code.includes('i < numbers.length;') || code.includes('i <= numbers.length - 1')) {
      // Fixed code visits all elements
      const max = Math.max(...numbers);
      simulatedStdout = `${max}\n`;
    } else {
      // Buggy code (numbers.length - 1) misses last element
      const buggyNumbers = numbers.slice(0, -1);
      const max = buggyNumbers.length > 0 ? Math.max(...buggyNumbers) : numbers[0];
      simulatedStdout = `${max}\n`;
    }
  } else if (code.includes('sumPositive') || code.includes('sum-positive')) {
    // Sum positive numbers simulation
    const allNums = (stdin.match(/-?\d+/g) || []).map(Number);
    const numbers = allNums.length > 1 ? allNums.slice(1) : [];
    if (code.includes('numbers[i] > 0') || code.includes('> 0')) {
      const sum = numbers.filter(n => n > 0).reduce((acc, curr) => acc + curr, 0);
      simulatedStdout = `${sum}\n`;
    } else {
      const sum = numbers.reduce((acc, curr) => acc + curr, 0);
      simulatedStdout = `${sum}\n`;
    }
  } else {
    // Default simulated output: echo stdin or sample
    simulatedStdout = stdin ? (stdin.endsWith('\n') ? stdin : `${stdin}\n`) : 'output\n';
  }

  const normOut = normalizeOutput(simulatedStdout);
  const normExp = normalizeOutput(expectedOutput || '');
  const isMatch = expectedOutput !== null ? normOut === normExp : true;

  return {
    status: isMatch ? STATUS.PASSED : STATUS.WRONG_OUTPUT,
    judgeStatusId: isMatch ? 3 : 4,
    judgeStatusDescription: isMatch ? 'Accepted' : 'Wrong Answer',
    stdout: simulatedStdout,
    stderr: null,
    timeMs: 25,
    memoryKb: 1536
  };
}
