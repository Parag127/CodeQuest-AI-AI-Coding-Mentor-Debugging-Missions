// Seed challenges for CodeDNA catalog
export const seedChallenges = [
  {
    id: 'sum-array',
    title: 'Sum of Array Elements',
    description: 'Write a function that calculates and returns the sum of all numbers in an integer array. Return 0 for an empty array.',
    difficulty: 'beginner',
    concept: 'loops',
    skills: ['arrays', 'loops', 'accumulators'],
    targetedPatterns: ['loop_boundary', 'empty_input'],
    languages: ['javascript', 'java'],
    hintFallbacks: {
      1: 'Think about how you initialize your sum accumulator before you start iterating through the array elements.',
      2: 'Pay close attention to your loop initialization and boundary condition to ensure every valid element is visited exactly once.',
      3: 'Make sure your loop index starts at 0 and stops strictly before array length (< array.length), and remember to handle the empty array case.'
    },
    publicTestCases: [
      { id: 'sa-pub-1', stdin: '[1, 2, 3, 4]', expected_output: '10' },
      { id: 'sa-pub-2', stdin: '[-1, 5, 2]', expected_output: '6' },
      { id: 'sa-pub-3', stdin: '[42]', expected_output: '42' }
    ],
    hiddenTestCases: [
      { id: 'sa-hid-1', stdin: '[]', expected_output: '0' },
      { id: 'sa-hid-2', stdin: '[100, -100, 50, -50]', expected_output: '0' }
    ]
  },
  {
    id: 'find-max',
    title: 'Find Maximum Element',
    description: 'Write a function that returns the largest number in a non-empty array of integers.',
    difficulty: 'beginner',
    concept: 'conditions',
    skills: ['arrays', 'conditionals', 'extrema'],
    targetedPatterns: ['wrong_condition', 'wrong_index'],
    languages: ['javascript', 'java'],
    hintFallbacks: {
      1: 'Consider what initial value you use to compare against the remaining items in the array.',
      2: 'Initialize your maximum tracker with the very first element of the array instead of an arbitrary number like 0, especially for negative numbers.',
      3: 'Loop through indices 1 up to length - 1, updating your tracker whenever the current element is greater than your current maximum.'
    },
    publicTestCases: [
      { id: 'fm-pub-1', stdin: '[3, 7, 2, 9, 4]', expected_output: '9' },
      { id: 'fm-pub-2', stdin: '[-10, -3, -20, -5]', expected_output: '-3' },
      { id: 'fm-pub-3', stdin: '[100]', expected_output: '100' }
    ],
    hiddenTestCases: [
      { id: 'fm-hid-1', stdin: '[5, 5, 5, 5]', expected_output: '5' },
      { id: 'fm-hid-2', stdin: '[-1, 0, 1]', expected_output: '1' }
    ]
  },
  {
    id: 'reverse-string',
    title: 'Reverse a String',
    description: 'Write a function that returns the reverse of a given string. Return an empty string if the input is empty.',
    difficulty: 'beginner',
    concept: 'loops',
    skills: ['strings', 'loops', 'indexing'],
    targetedPatterns: ['loop_boundary', 'wrong_index', 'empty_input'],
    languages: ['javascript', 'java'],
    hintFallbacks: {
      1: 'Consider building the result by iterating through the characters in reverse order.',
      2: 'Make sure your loop starts at length - 1 and stops when the index reaches 0 inclusive.',
      3: 'Remember that string indices start at 0 and end at string.length - 1.'
    },
    publicTestCases: [
      { id: 'rs-pub-1', stdin: '"hello"', expected_output: '"olleh"' },
      { id: 'rs-pub-2', stdin: '"code"', expected_output: '"edoc"' }
    ],
    hiddenTestCases: [
      { id: 'rs-hid-1', stdin: '""', expected_output: '""' },
      { id: 'rs-hid-2', stdin: '"a"', expected_output: '"a"' }
    ]
  },
  {
    id: 'filter-positive',
    title: 'Filter Positive Numbers',
    description: 'Write a function that filters an array of integers and returns only the positive numbers (greater than zero).',
    difficulty: 'intermediate',
    concept: 'conditions',
    skills: ['arrays', 'conditionals', 'filtering'],
    targetedPatterns: ['wrong_condition', 'empty_input'],
    languages: ['javascript', 'java'],
    hintFallbacks: {
      1: 'Check each element to see if it strictly satisfies the condition of being greater than zero.',
      2: 'Remember that zero is neither positive nor negative; use strict comparison > 0 rather than >= 0.',
      3: 'Append valid elements to a new array and return it, even if empty.'
    },
    publicTestCases: [
      { id: 'fp-pub-1', stdin: '[-2, 5, 0, 8, -1]', expected_output: '[5, 8]' },
      { id: 'fp-pub-2', stdin: '[1, 2, 3]', expected_output: '[1, 2, 3]' }
    ],
    hiddenTestCases: [
      { id: 'fp-hid-1', stdin: '[-5, -1, 0]', expected_output: '[]' },
      { id: 'fp-hid-2', stdin: '[]', expected_output: '[]' }
    ]
  }
];

export function getChallengeById(id) {
  return seedChallenges.find(c => c.id === id) || null;
}

export function getAllChallenges() {
  return [...seedChallenges];
}
