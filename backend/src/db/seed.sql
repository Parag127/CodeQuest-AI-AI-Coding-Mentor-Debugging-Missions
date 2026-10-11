-- CodeDNA Seed Data
-- Seed challenges and test cases matching API_CONTRACT.md

-- Challenge 1: Find the largest number (Matches API_CONTRACT.md)
INSERT OR IGNORE INTO challenges (
  id,
  title,
  description,
  difficulty,
  concept,
  languages,
  starter_code_javascript,
  starter_code_java,
  hint_level_1,
  hint_level_2,
  hint_level_3
) VALUES (
  'largest-number',
  'Find the largest number',
  'Debug the program so it prints the largest integer in the input array.',
  'easy',
  'loop_boundary',
  '["javascript", "java"]',
  'const fs = require(''fs'');

function findLargest(numbers) {
  // Buggy implementation: loops until numbers.length - 1 with < boundary, missing the last item
  let max = numbers[0];
  for (let i = 1; i < numbers.length - 1; i++) {
    if (numbers[i] > max) {
      max = numbers[i];
    }
  }
  return max;
}

const input = fs.readFileSync(0, ''utf-8'').trim();
if (input.length > 0) {
  const lines = input.split(''\n'');
  const numbers = (lines[1] || lines[0]).trim().split(/\s+/).map(Number);
  console.log(findLargest(numbers));
}',
  'import java.util.Scanner;
import java.util.ArrayList;

public class Main {
    public static int findLargest(int[] numbers) {
        // Buggy implementation: loops until numbers.length - 1 with < boundary, missing the last item
        int max = numbers[0];
        for (let i = 1; i < numbers.length - 1; i++) {
            if (numbers[i] > max) {
                max = numbers[i];
            }
        }
        return max;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            int[] numbers = new int[n];
            for (int i = 0; i < n; i++) {
                numbers[i] = scanner.nextInt();
            }
            System.out.println(findLargest(numbers));
        }
    }
}',
  'The loop may be stopping before it visits every element. Look closely at the loop continuation condition.',
  'Check how many elements your array has versus the highest index your loop reaches. Is the last element ever inspected?',
  'Change the condition `i < numbers.length - 1` to `i < numbers.length` so that the loop iterates through all elements of the array.'
);

-- Test cases for largest-number
INSERT OR IGNORE INTO test_cases (id, challenge_id, is_public, stdin, expected_output, ordinal)
VALUES
  ('visible-1', 'largest-number', 1, '4\n2 5 1 9\n', '9\n', 1),
  ('visible-2', 'largest-number', 1, '3\n10 20 30\n', '30\n', 2),
  ('visible-3', 'largest-number', 1, '1\n42\n', '42\n', 3),
  ('hidden-1', 'largest-number', 0, '4\n-10 -5 -20 -1\n', '-1\n', 4),
  ('hidden-2', 'largest-number', 0, '4\n100 50 100 25\n', '100\n', 5);

-- Challenge 2: Reverse a String
INSERT OR IGNORE INTO challenges (
  id,
  title,
  description,
  difficulty,
  concept,
  languages,
  starter_code_javascript,
  starter_code_java,
  hint_level_1,
  hint_level_2,
  hint_level_3
) VALUES (
  'reverse-string',
  'Reverse a String',
  'Write a function or program that reads a string from standard input and prints the reversed string to standard output.',
  'easy',
  'string_reversal',
  '["javascript", "java"]',
  'const fs = require(''fs'');

function solution(str) {
  // TODO: Return the reversed string
  return str;
}

const input = fs.readFileSync(0, ''utf-8'').trim();
console.log(solution(input));',
  'import java.util.Scanner;

public class Main {
    public static String solution(String str) {
        // TODO: Return the reversed string
        return str;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextLine()) {
            String input = scanner.nextLine();
            System.out.println(solution(input));
        }
    }
}',
  'Think about how you can access characters of a string starting from the last index and moving backwards towards 0.',
  'In JavaScript, strings can be split into character arrays (.split('''')), reversed (.reverse()), and joined (.join('''')). In Java, you can iterate backwards or use StringBuilder(str).reverse().toString().',
  'If using a loop, check your starting index and condition: start at str.length - 1 and decrement i until i >= 0. Remember strings are 0-indexed.'
);

-- Test cases for Reverse a String
INSERT OR IGNORE INTO test_cases (id, challenge_id, is_public, stdin, expected_output, ordinal)
VALUES
  ('tc-rev-1', 'reverse-string', 1, 'hello\n', 'olleh\n', 1),
  ('tc-rev-2', 'reverse-string', 1, 'world\n', 'dlrow\n', 2),
  ('tc-rev-3', 'reverse-string', 1, 'CodeDNA\n', 'ANDedoC\n', 3),
  ('tc-rev-4-h', 'reverse-string', 0, 'racecar\n', 'racecar\n', 4),
  ('tc-rev-5-h', 'reverse-string', 0, '1234567890\n', '0987654321\n', 5);
