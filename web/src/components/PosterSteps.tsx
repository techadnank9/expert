export function PosterSteps({ step }: { step: 1 | 2 | 3 }) {
  const labels = step === 1 ? ['1 Post', '2 In progress', '3 Review'] : step === 2 ? ['1 Posted', '2 In progress', '3 Review'] : ['1 Posted', '2 Done', '3 Review']
  return (
    <div className="steps">
      {labels.map((l, i) => (
        <span key={l} className={`pill ${i + 1 === step ? 'pill-dark' : i + 1 < step ? 'pill-green' : 'pill-grey'}`}>{l}</span>
      ))}
    </div>
  )
}
