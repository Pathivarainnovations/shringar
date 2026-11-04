const ITEMS = [
  { t: "Verified providers", c: "ID and licence verified by admin before approval." },
  { t: "SOS and trip sharing", c: "Send your stylist's details to a family member with one tap." },
  { t: "Private numbers", c: "Call or chat in the app without sharing your phone number." },
];

export default function Safety() {
  return (
    <section id="safety">
      <h2>Built for safe home visits</h2>
      <p className="sub">Trust matters most when someone comes to your home.</p>
      <div className="safe">
        {ITEMS.map((i) => (
          <div key={i.t}>
            <h3>{i.t}</h3>
            <p>{i.c}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
