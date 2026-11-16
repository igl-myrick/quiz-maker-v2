import { QuestionFieldset } from 'quiz-maker'

const singleChoice = {
  id: 'q-capital-au',
  position: 1,
  type: 'single_choice' as const,
  prompt: 'What is the capital of Australia?',
  options: [
    { id: 'o1', position: 1, label: 'Sydney' },
    { id: 'o2', position: 2, label: 'Canberra' },
    { id: 'o3', position: 3, label: 'Melbourne' },
  ],
}

const multiSelect = {
  id: 'q-capitals-multi',
  position: 2,
  type: 'multi_select' as const,
  prompt: 'Which of these cities are capitals?',
  options: [
    { id: 'm1', position: 1, label: 'Ottawa' },
    { id: 'm2', position: 2, label: 'Lima' },
    { id: 'm3', position: 3, label: 'Istanbul' },
  ],
}

const trueFalse = {
  id: 'q-rio',
  position: 3,
  type: 'true_false' as const,
  prompt: 'Rio de Janeiro is the capital of Brazil.',
  options: [
    { id: 't1', position: 1, label: 'True' },
    { id: 't2', position: 2, label: 'False' },
  ],
}

export function SingleChoice() {
  return (
    <QuestionFieldset
      takeKey="preview"
      question={singleChoice}
      number={1}
      total={3}
      chosen={['o2']}
      showMissing={false}
    />
  )
}

export function MultiSelect() {
  return (
    <QuestionFieldset
      takeKey="preview"
      question={multiSelect}
      number={2}
      total={3}
      chosen={['m1', 'm2']}
      showMissing={false}
    />
  )
}

export function Unanswered() {
  return (
    <QuestionFieldset
      takeKey="preview"
      question={trueFalse}
      number={3}
      total={3}
      chosen={[]}
      showMissing
    />
  )
}
