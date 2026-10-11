/**
 * End-to-End Live Verification Script
 * Validates actual runtime integration of all DebugMate endpoints,
 * security boundaries, hidden test privacy invariants, and error resilience.
 */
import app from '../index.js';
import db from '../db/index.js';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[VERIFY] Test server listening on ${baseUrl}`);
      resolve();
    });
  });
}

function stopServer() {
  if (server) {
    server.close();
    console.log('[VERIFY] Test server closed');
  }
}

const check = (description, condition) => {
  if (condition) {
    console.log(`  PASS: ${description}`);
  } else {
    console.error(`  FAIL: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
};

async function run() {
  console.log('\n=============================================');
  console.log('   DebugMate End-to-End Live Verification');
  console.log('=============================================\n');

  process.env.JUDGE0_MOCK_RUNNER = 'true';

  await startServer();

  try {
    // 1. Health Probe
    console.log('[STEP 1] Testing GET /api/health ...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    check('Health response status is 200', healthRes.status === 200);
    const healthData = await healthRes.json();
    check('Health status is healthy', healthData.status === 'healthy');
    check('Health includes service identifier', healthData.service === 'debugmate-api');
    check('Health includes memory usage metrics', typeof healthData.memoryUsageMB?.heapUsed === 'number');

    // 2. Info Probe
    console.log('\n[STEP 2] Testing GET /api/info ...');
    const infoRes = await fetch(`${baseUrl}/api/info`);
    check('Info response status is 200', infoRes.status === 200);
    const infoData = await infoRes.json();
    check('Info includes architecture', Boolean(infoData.arch));
    check('Info includes node version', Boolean(infoData.nodeVersion));

    // 3. Challenges Catalog
    console.log('\n[STEP 3] Testing GET /api/challenges ...');
    const chalRes = await fetch(`${baseUrl}/api/challenges`);
    check('Challenges catalog status is 200', chalRes.status === 200);
    const chalData = await chalRes.json();
    check('Challenges array exists and has at least 3 challenges', chalData.challenges?.length >= 3);
    const hasLargest = chalData.challenges.some(c => c.id === 'largest-number');
    check('Catalog contains largest-number challenge', hasLargest);
    // Privacy invariant: zero test cases or starter code in catalog
    const hasAnyTests = chalData.challenges.some(c => c.visibleTests || c.testCases || c.starterCode);
    check('Catalog strictly excludes test cases and starter code', !hasAnyTests);

    // 4. Challenge Detail & Visible Tests Only
    console.log('\n[STEP 4] Testing GET /api/challenges/largest-number ...');
    const detailRes = await fetch(`${baseUrl}/api/challenges/largest-number`);
    check('Challenge detail status is 200', detailRes.status === 200);
    const detailData = await detailRes.json();
    check('Challenge detail contains description', Boolean(detailData.challenge?.description));
    check('Challenge detail contains starterCode for js and java', 
      Boolean(detailData.challenge?.starterCode?.javascript && detailData.challenge?.starterCode?.java));
    check('Challenge visibleTests contains visible tests', detailData.challenge?.visibleTests?.length >= 3);
    // Verify hidden tests are NOT returned
    const detailText = JSON.stringify(detailData);
    check('Hidden test ids do NOT appear in challenge detail', !detailText.includes('hidden-1'));

    // 5. Unknown Challenge
    console.log('\n[STEP 5] Testing GET /api/challenges/unknown-id ...');
    const notFoundRes = await fetch(`${baseUrl}/api/challenges/unknown-id`);
    check('Unknown challenge returns 404', notFoundRes.status === 404);
    const notFoundData = await notFoundRes.json();
    check('Error code is CHALLENGE_NOT_FOUND', notFoundData.error?.code === 'CHALLENGE_NOT_FOUND');

    // 6. JavaScript Correct Submission
    console.log('\n[STEP 6] Testing POST /api/submissions (JS correct solution) ...');
    const jsCorrectCode = `
const fs = require('fs');
function findLargest(numbers) {
  let max = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > max) { max = numbers[i]; }
  }
  return max;
}
const input = fs.readFileSync(0, 'utf-8').trim();
if (input.length > 0) {
  const lines = input.split('\\n');
  const numbers = (lines[1] || lines[0]).trim().split(/\\s+/).map(Number);
  console.log(findLargest(numbers));
}
`;
    const subJsRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': 'verify-learner' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'javascript',
        code: jsCorrectCode
      })
    });
    check('Submission status is 200', subJsRes.status === 200);
    const subJsData = await subJsRes.json();
    check('Overall status is passed', subJsData.status === 'passed');
    check('Results contains 5 tests', subJsData.results?.length === 5);
    check('All 5 tests passed', subJsData.results.every(r => r.status === 'passed'));
    check('Feedback is null on success', subJsData.feedback === null);

    // 7. Java Correct Submission
    console.log('\n[STEP 7] Testing POST /api/submissions (Java correct solution) ...');
    const javaCorrectCode = `
import java.util.Scanner;
public class Main {
    public static int findLargest(int[] numbers) {
        int max = numbers[0];
        for (int i = 1; i < numbers.length; i++) {
            if (numbers[i] > max) max = numbers[i];
        }
        return max;
    }
    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        if (s.hasNextInt()) {
            int n = s.nextInt();
            int[] a = new int[n];
            for (int i=0; i<n; i++) a[i] = s.nextInt();
            System.out.println(findLargest(a));
        }
    }
}
`;
    const subJavaRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': 'verify-learner' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'java',
        code: javaCorrectCode
      })
    });
    check('Java submission status is 200', subJavaRes.status === 200);
    const subJavaData = await subJavaRes.json();
    check('Java overall status is passed', subJavaData.status === 'passed');
    check('Java all 5 tests passed', subJavaData.results.every(r => r.status === 'passed'));

    // 8. Buggy Submission & Hidden Test Privacy Invariants
    console.log('\n[STEP 8] Testing POST /api/submissions (Buggy code with boundary error) ...');
    const buggyCode = `
const fs = require('fs');
function findLargest(numbers) {
  let max = numbers[0];
  for (let i = 1; i < numbers.length - 1; i++) {
    if (numbers[i] > max) max = numbers[i];
  }
  return max;
}
const input = fs.readFileSync(0, 'utf-8').trim();
if (input.length > 0) {
  const lines = input.split('\\n');
  const numbers = (lines[1] || lines[0]).trim().split(/\\s+/).map(Number);
  console.log(findLargest(numbers));
}
`;
    const subBugRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': 'verify-learner' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'javascript',
        code: buggyCode,
        prediction: 'Loops through elements',
        explanation: 'Off by one condition'
      })
    });
    check('Buggy submission status is 200', subBugRes.status === 200);
    const subBugRaw = await subBugRes.text();
    const subBugData = JSON.parse(subBugRaw);
    check('Buggy overall status is failed', subBugData.status === 'failed');
    check('Visible test contains expected and actual', subBugData.results.some(r => r.visibility === 'visible' && r.expected && r.actual));
    
    // Privacy verification on hidden tests
    const hiddenTests = subBugData.results.filter(r => r.visibility === 'hidden');
    check('Hidden tests exist in results', hiddenTests.length === 2);
    for (const ht of hiddenTests) {
      check('Hidden test has no expected output', ht.expected === undefined);
      check('Hidden test has no actual output', ht.actual === undefined);
      check('Hidden test has no stdin', ht.stdin === undefined);
      check('Hidden test has no stdout', ht.stdout === undefined);
      check('Hidden test has no stderr', ht.stderr === undefined);
      const keys = Object.keys(ht).sort();
      check('Hidden test object has exactly [status, testId, visibility]', 
        JSON.stringify(keys) === JSON.stringify(['status', 'testId', 'visibility']));
    }

    // Verify raw JSON response string has ZERO occurrence of hidden test inputs
    check('Raw JSON does not contain hidden test input -10 -5 -20 -1', !subBugRaw.includes('-10 -5 -20 -1'));

    // Feedback verification
    check('Feedback identifies bugCategory as loop_boundary', subBugData.feedback?.bugCategory === 'loop_boundary');
    check('Feedback includes pedagogical summary', subBugData.feedback?.summary?.includes('loop'));

    // 9. Progressive Hint Route
    console.log('\n[STEP 9] Testing POST /api/hints ...');
    const hintRes = await fetch(`${baseUrl}/api/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: subBugData.submissionId,
        hintLevel: 1
      })
    });
    check('Hint response status is 200', hintRes.status === 200);
    const hintData = await hintRes.json();
    check('Hint level is 1', hintData.hintLevel === 1);
    check('Hint text is provided', Boolean(hintData.hint && hintData.hint.length > 10));

    // 10. Explain Before You Fix Route
    console.log('\n[STEP 10] Testing POST /api/hints/explain-before-fix ...');
    const ebyfRes = await fetch(`${baseUrl}/api/hints/explain-before-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: subBugData.submissionId,
        prediction: 'Loop misses last index',
        explanation: 'Used numbers.length - 1'
      })
    });
    check('EBYF response status is 200', ebyfRes.status === 200);
    const ebyfData = await ebyfRes.json();
    check('EBYF provides feedback', Boolean(ebyfData.feedback));
    check('canProceedToHint is true', ebyfData.canProceedToHint === true);

    // 11. Security Guardrails: Payload Limits & Error Handling
    console.log('\n[STEP 11] Testing Security Guardrails & Error Boundaries ...');
    
    // Malformed JSON (syntax error)
    const malformedJsonRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json }'
    });
    check('Malformed JSON returns 400', malformedJsonRes.status === 400);

    // Non-object body
    const nonObjectRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['an-array'])
    });
    check('Array body returns 400 INVALID_REQUEST', nonObjectRes.status === 400);

    // Code size > 64KB
    const oversizedCodeRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'javascript',
        code: 'a'.repeat(66000)
      })
    });
    check('Oversized code returns 413 PAYLOAD_TOO_LARGE', oversizedCodeRes.status === 413);

    // Unconfigured runner returns 503 without crashing
    delete process.env.JUDGE0_MOCK_RUNNER;
    delete process.env.JUDGE0_API_URL;
    const unconfiguredRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'javascript',
        code: 'console.log(1);'
      })
    });
    check('Unconfigured runner returns 503 RUNNER_NOT_CONFIGURED', unconfiguredRes.status === 503);
    process.env.JUDGE0_MOCK_RUNNER = 'true';

    console.log('\n=============================================');
    console.log('   ALL 11 VERIFICATION PHASES PASSED!');
    console.log('=============================================\n');

  } finally {
    stopServer();
  }
}

run().catch((err) => {
  console.error('[VERIFY_ERROR]', err);
  stopServer();
  process.exit(1);
});
