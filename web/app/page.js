function Stepper({ at }) {
  return (
    <div className="stepper" aria-label="Progress">
      {STAGES.map((n, i) => {
        const isDone = i < at || at >= STAGES.length;
        const isNow = i === Math.min(at, STAGES.length - 1);
        return (
          <div
            key={n}
            className={"st" + (isDone ? " done" : "") + (isNow ? " now" : "")}
          >
            <span>{i < at ? "✓" : i + 1}</span>
            <em>{n}</em>
          </div>
        );
      })}
    </div>
  );
}

const Next = ({ children }) => <p className="next fade" role="status">{children}</p>;
