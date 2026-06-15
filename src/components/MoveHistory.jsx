export default function MoveHistory({ moves = [] }) {
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      number: Math.floor(index / 2) + 1,
      white: moves[index],
      black: moves[index + 1],
    });
  }

  return (
    <section className="panel move-history">
      <div className="panel-heading">
        <h2>Moves</h2>
      </div>
      <div className="move-list">
        {rows.length === 0 ? (
          <p className="muted">No moves yet.</p>
        ) : (
          rows.map((row) => (
            <div className="move-row" key={row.number}>
              <span>{row.number}</span>
              <strong>{row.white?.san ?? row.white?.lan}</strong>
              <strong>{row.black?.san ?? row.black?.lan}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
