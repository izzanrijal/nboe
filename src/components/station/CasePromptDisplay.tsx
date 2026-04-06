interface CasePromptDisplayProps {
  title: string;
  prompt: string;
  questionsText?: string;
}

const CasePromptDisplay = ({ title, prompt, questionsText }: CasePromptDisplayProps) => {
  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-foreground">{title}</h2>
      <div className="bg-card border border-border rounded-xl p-8">
        <p className="text-xl leading-relaxed text-card-foreground whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
      {questionsText && (
        <div className="bg-card border border-primary/30 rounded-xl p-8">
          <h3 className="text-lg font-semibold text-primary mb-3">Soal / Pertanyaan</h3>
          <p className="text-xl leading-relaxed text-card-foreground whitespace-pre-wrap">
            {questionsText}
          </p>
        </div>
      )}
    </div>
  );
};

export default CasePromptDisplay;
