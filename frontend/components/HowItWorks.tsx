const STEPS = [
  { t: "Choose a service", c: "Pick what you need and where you want it." },
  { t: "Get matched", c: "Nearby stylists accept your price or send a counter-offer." },
  { t: "Track your stylist", c: "See their live location and arrival time." },
  { t: "Pay and review", c: "Pay in the app or in cash, then rate the visit." },
];

export default function HowItWorks() {
  return (
    <section id="how">
      <h2>How it works</h2>
      <p className="sub">Home visits follow the same steps as a ride: request, match, track, pay.</p>
      <div className="steps">
        {STEPS.map((s) => (
          <div key={s.t}>
            <h3>{s.t}</h3>
            <p>{s.c}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
