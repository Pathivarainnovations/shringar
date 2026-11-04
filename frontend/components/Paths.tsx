const PATHS = [
  {
    id: "home",
    title: "At your home",
    copy: "Verified stylists come to you. Name your price and track them live.",
    cta: "Book at home",
    image: "/asset-2.jpg",
  },
  {
    id: "salon",
    title: "At the salon",
    copy: "Pick a salon, a stylist and a time slot. Skip the wait.",
    cta: "Find a salon",
    image: "/asset-3.jpg",
  },
];

export default function Paths() {
  return (
    <section id="paths">
      <h2>Choose your path</h2>
      <p className="sub">Two ways to get the same trusted service.</p>
      <div className="paths">
        {PATHS.map((p) => (
          <a className="path" href="#book" data-m={p.id} key={p.id}>
            <img src={p.image} alt="" aria-hidden="true" />
            <div>
              <h3>{p.title}</h3>
              <p>{p.copy}</p>
              <span className="btn gold">{p.cta}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
