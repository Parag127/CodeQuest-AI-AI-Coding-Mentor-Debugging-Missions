// Seed challenges for CodeDNA
export const seedChallenges = [
  {
    id: 'sum-array',
    title: 'Sum of Array Elements',
    description: 'Write a function that calculates and returns the sum of all numbers in an integer array. Return 0 for an empty array.',
    difficulty: 'beginner',
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
  }
];

export function getChallengeById(id) {
  return seedChallenges.find(c => c.id === id) || null;
}
