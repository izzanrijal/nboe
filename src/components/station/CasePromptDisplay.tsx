interface CasePromptDisplayProps {
  title: string;
  prompt: string;
}

const CasePromptDisplay = ({ title, prompt }: CasePromptDisplayProps) => {
  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-foreground">{title}</h2>
      <div className="bg-card border border-border rounded-xl p-8">
        <p className="text-xl leading-relaxed text-card-foreground whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
    </div>
  );
};

export default CasePromptDisplay;
