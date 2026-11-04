import { FAQS } from "@/lib/content";

export default function Faq() {
  return (
    <section id="faq">
      <h2>Questions</h2>
      {FAQS.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}
