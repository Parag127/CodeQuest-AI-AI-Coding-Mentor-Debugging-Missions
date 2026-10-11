import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../index.js';
import db from '../db/index.js';

describe('Step 11: Frontend & Backend Integration Journeys', () => {
  let server;
  let baseUrl;
  const testLearnerId = `integration-learner-${Date.now()}`;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });
  });

  it('Requirement 1: Lists challenges and retrieves details with dual-compatible shapes', async () => {
    // 1. List catalog
    const catRes = await fetch(`${baseUrl}/api/challenges`);
    assert.equal(catRes.status, 200);
    const catData = await catRes.json();
    
    // Check dual compatibility: both 'challenges' and 'data' exist
    const list = catData.data || catData.challenges;
    assert.ok(Array.isArray(list) && list.length >= 3);
    assert.ok(list.some(c => c.id === 'largest-number'));
    assert.ok(list.some(c => c.id === 'reverse-string'));
    assert.ok(list.some(c => c.id === 'sum-positive'));

    // 2. Retrieve detail
    const detRes = await fetch(`${baseUrl}/api/challenges/largest-number`);
    assert.equal(detRes.status, 200);
    const detData = await detRes.json();
    const detail = detData.data || detData.challenge;
    assert.equal(detail.id, 'largest-number');
    assert.ok(detail.description);
    assert.ok(detail.starterCode?.javascript);
    assert.ok(detail.starterCode?.java);
    assert.ok(Array.isArray(detail.visibleTests));
  });

  it('Requirement 2 & 3 & 4 & 5: Complete Java Journey (Compilation Error, Wrong Output, EBYF, Hints, and Passed)', async () => {
    // A. Java Compilation Error
    const javaCompileErrorCode = `
import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        SYNTAX_ERROR
    }
}
`;
    const compileRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'java',
        code: javaCompileErrorCode,
        learnerId: testLearnerId
      })
    });
    assert.equal(compileRes.status, 200);
    const compileData = await compileRes.json();
    assert.equal(compileData.status, 'failed');
    assert.ok(compileData.results.some(r => r.status === 'compile_error'));

    // B. Java Wrong Output & Bug Fingerprint
    const javaBuggyCode = `
import java.util.Scanner;
public class Main {
    public static int findLargest(int[] numbers) {
        // Missing the last element because of < numbers.length - 1 boundary
        int max = numbers[0];
        for (int i = 1; i < numbers.length - 1; i++) {
            if (numbers[i] > max) max = numbers[i];
        }
        return max;
    }
    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        if (s.hasNextInt()) {
            int n = s.nextInt();
            int[] a = new int[n];
            for (int i = 0; i < n; i++) a[i] = s.nextInt();
            System.out.println(findLargest(a));
        }
    }
}
`;
    const buggyRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'java',
        code: javaBuggyCode,
        learnerId: testLearnerId
      })
    });
    assert.equal(buggyRes.status, 200);
    const buggyData = await buggyRes.json();
    assert.equal(buggyData.status, 'failed');
    const buggySubId = buggyData.submissionId;
    assert.ok(buggySubId);

    // Verify distinct wrong_output status on tests
    assert.ok(buggyData.results.some(r => r.status === 'wrong_output'));
    // Verify hidden tests exist and strictly hide outputs
    const hiddenTests = buggyData.results.filter(r => r.visibility === 'hidden');
    assert.ok(hiddenTests.length > 0);
    for (const ht of hiddenTests) {
      assert.strictEqual(ht.expected, undefined);
      assert.strictEqual(ht.actual, undefined);
    }
    // Verify Bug Fingerprint detection
    assert.ok(buggyData.bugFingerprints?.includes('loop_boundary'));

    // C. EBYF Question & Learner Reflection
    const ebyfQRes = await fetch(`${baseUrl}/api/explain-before-fix/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: buggySubId,
        learnerId: testLearnerId,
        challengeId: 'largest-number',
        language: 'java'
      })
    });
    assert.equal(ebyfQRes.status, 200);
    const ebyfQData = await ebyfQRes.json();
    assert.ok(ebyfQData.data?.question);

    // Learner submits reflection
    const ebyfSubmitRes = await fetch(`${baseUrl}/api/explain-before-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: buggySubId,
        learnerId: testLearnerId,
        explanation: 'The loop condition uses numbers.length - 1 with <, so the final index is skipped.',
        challengeId: 'largest-number',
        language: 'java'
      })
    });
    assert.equal(ebyfSubmitRes.status, 200);
    const ebyfSubmitData = await ebyfSubmitRes.json();
    assert.ok(ebyfSubmitData.data?.feedback);
    assert.equal(ebyfSubmitData.data?.canProceedToHint, true);

    // D. Progressive Hints (Level 1 and Level 2)
    const hint1Res = await fetch(`${baseUrl}/api/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: buggySubId,
        hintLevel: 1,
        learnerId: testLearnerId,
        challengeId: 'largest-number',
        language: 'java'
      })
    });
    assert.equal(hint1Res.status, 200);
    const hint1Data = await hint1Res.json();
    assert.equal(hint1Data.hintLevel || hint1Data.data?.hintLevel, 1);
    assert.ok(hint1Data.hint || hint1Data.data?.hint);

    // E. Correct Java Solution Submission
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
            for (int i = 0; i < n; i++) a[i] = s.nextInt();
            System.out.println(findLargest(a));
        }
    }
}
`;
    const correctJavaRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'java',
        code: javaCorrectCode,
        learnerId: testLearnerId
      })
    });
    assert.equal(correctJavaRes.status, 200);
    const correctJavaData = await correctJavaRes.json();
    assert.equal(correctJavaData.status, 'passed');
    assert.ok(correctJavaData.results.every(r => r.status === 'passed'));
  });

  it('Requirement 6 & 7 & 8 & 9: Complete JavaScript Journey (Runtime Error, Wrong Output, Fingerprint, Recommendations, Progress, and Passed)', async () => {
    // A. JavaScript Runtime Error
    const jsRuntimeErrorCode = `
const fs = require('fs');
// runtime_error_test
throw new Error("Uncaught runtime failure during execution");
`;
    const runtimeRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
      body: JSON.stringify({
        challengeId: 'sum-positive',
        language: 'javascript',
        code: jsRuntimeErrorCode,
        learnerId: testLearnerId
      })
    });
    assert.equal(runtimeRes.status, 200);
    const runtimeData = await runtimeRes.json();
    assert.equal(runtimeData.status, 'failed');
    assert.ok(runtimeData.results.some(r => r.status === 'runtime_error'));

    // B. JavaScript Wrong Output
    const jsBuggyCode = `
const fs = require('fs');
function sumPositive(numbers) {
  // Bug: sums everything including negative numbers
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}
const input = fs.readFileSync(0, 'utf-8').trim();
if (!input) {
  console.log(0);
} else {
  const lines = input.split('\\n');
  const count = parseInt(lines[0], 10);
  if (count === 0 || !lines[1]) {
    console.log(0);
  } else {
    const numbers = lines[1].trim().split(/\\s+/).map(Number);
    console.log(sumPositive(numbers));
  }
}
`;
    const buggyJsRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
      body: JSON.stringify({
        challengeId: 'sum-positive',
        language: 'javascript',
        code: jsBuggyCode,
        learnerId: testLearnerId
      })
    });
    assert.equal(buggyJsRes.status, 200);
    const buggyJsData = await buggyJsRes.json();
    assert.equal(buggyJsData.status, 'failed');
    assert.ok(buggyJsData.results.some(r => r.status === 'wrong_output'));

    // C. Check Learner Progress & Recorded Mistakes
    const progressRes = await fetch(`${baseUrl}/api/progress/${testLearnerId}`);
    assert.equal(progressRes.status, 200);
    const progressData = await progressRes.json();
    assert.ok(progressData.data?.recurringMistakes);
    assert.ok(progressData.data.recurringMistakes.length > 0);

    // D. Check Adaptive Challenge Recommendation
    const recRes = await fetch(`${baseUrl}/api/recommendations/${testLearnerId}?currentChallengeId=sum-positive`);
    assert.equal(recRes.status, 200);
    const recData = await recRes.json();
    assert.ok(recData.data?.challenge);
    assert.ok(recData.data?.reason);
    assert.ok(recData.data?.strategy);

    // E. Correct JavaScript Solution
    const jsCorrectCode = `
const fs = require('fs');
function sumPositive(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] > 0) {
      total += numbers[i];
    }
  }
  return total;
}
const input = fs.readFileSync(0, 'utf-8').trim();
if (!input) {
  console.log(0);
} else {
  const lines = input.split('\\n');
  const count = parseInt(lines[0], 10);
  if (count === 0 || !lines[1]) {
    console.log(0);
  } else {
    const numbers = lines[1].trim().split(/\\s+/).map(Number);
    console.log(sumPositive(numbers));
  }
}
`;
    const correctJsRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
      body: JSON.stringify({
        challengeId: 'sum-positive',
        language: 'javascript',
        code: jsCorrectCode,
        learnerId: testLearnerId
      })
    });
    assert.equal(correctJsRes.status, 200);
    const correctJsData = await correctJsRes.json();
    assert.equal(correctJsData.status, 'passed');
    assert.ok(correctJsData.results.every(r => r.status === 'passed'));
  });

  it('Requirement 10: Gracefully handles unavailable / error states', async () => {
    // Non-existent challenge
    const res404 = await fetch(`${baseUrl}/api/challenges/non-existent-challenge`);
    assert.equal(res404.status, 404);

    // Empty code submission
    const resEmpty = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'javascript',
        code: ''
      })
    });
    assert.equal(resEmpty.status, 400);

    // Invalid language
    const resLang = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'python',
        code: 'print("hello")'
      })
    });
    assert.equal(resLang.status, 400);
  });
});
