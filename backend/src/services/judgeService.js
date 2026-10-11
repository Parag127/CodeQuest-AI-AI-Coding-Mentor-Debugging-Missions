/**
 * Judge0 Code Execution Service
 * Handles code submission to Judge0 CE, status mapping, timeout/memory limits,
 * and safe fallback handling.
 */

// Judge0 Language IDs
export const LANGUAGE_IDS = {
  javascript: parseInt(process.env.JUDGE0_LANG_JS || '93', 10),
  java: parseInt(process.env.JUDGE0_LANG_JAVA || '91', 10)
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
 * 1: In Queue
 * 2: Processing
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
 * Ensures the class name matches Main as required by Judge0.
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

  // 1. If mock runner is active, execute via simulation
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

  // Request limits
  const requestBody = {
    source_code: sourceCode,
    language_id: languageId,
    stdin: stdin || '',
    expected_output: expectedOutput !== null ? expectedOutput : undefined,
    cpu_time_limit: parseFloat(process.env.JUDGE0_CPU_TIME_LIMIT || '5'),
    wall_time_limit: parseFloat(process.env.JUDGE0_WALL_TIME_LIMIT || '10'),
    memory_limit: parseInt(process.env.JUDGE0_MEMORY_LIMIT || '131072', 10)
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  if (process.env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';
  }

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/submissions?base64_encoded=false&wait=true`;

  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeout);
  } catch (fetchErr) {
    const err = new Error(`Failed to contact Judge0 runner: ${fetchErr.message}`);
    err.code = 'RUNNER_UNAVAILABLE';
    err.statusCode = 503;
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Judge0 responded with status ${response.status}: ${errText}`);
    err.code = 'RUNNER_ERROR';
    err.statusCode = response.status === 429 ? 429 : 503;
    throw err;
  }

  const judgeResult = await response.json();
  const rawStatusId = judgeResult.status ? judgeResult.status.id : 13;
  let internalStatus = mapJudgeStatus(rawStatusId);

  // If Judge0 didn't compare output, or for extra reliability, verify stdout vs expectedOutput
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
  // Syntax error detection
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

  // Timeout simulation
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

  // Runtime error simulation
  if (code.includes('runtime_error_test') || code.includes('throw new Error') || code.includes('NullPointerException')) {
    return {
      status: STATUS.RUNTIME_ERROR,
      judgeStatusId: 11,
      judgeStatusDescription: 'Runtime Error',
      stdout: null,
      stderr: language === 'java' ? 'Exception in thread "main" java.lang.NullPointerException' : 'TypeError: Cannot read properties of undefined',
      timeMs: 20,
      memoryKb: 1024
    };
  }

  // Output evaluation
  let simulatedStdout = '';

  // Hello World check
  if (code.includes('hello_world_correct')) {
    simulatedStdout = 'Hello World\n';
  } else if (code.includes('hello_world_wrong')) {
    simulatedStdout = 'Goodbye World\n';
  } else if (code.includes('reverse-string') || code.includes('reverseString') || code.includes('solution(str)')) {
    // Reverse string logic simulation
    if (code.includes('str.split(\'\').reverse().join(\'\')') || code.includes('reverse()')) {
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
  } else {
    // Default simulated output: echo stdin or sample
    simulatedStdout = stdin || 'output\n';
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
