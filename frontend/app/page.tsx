import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Paths from "@/components/Paths";
import Services from "@/components/Services";
import Planner from "@/components/Planner";
import HowItWorks from "@/components/HowItWorks";
import NameYourPrice from "@/components/NameYourPrice";
import Stylists from "@/components/Stylists";
import Dashboard from "@/components/Dashboard";
import Reviews from "@/components/Reviews";
import Safety from "@/components/Safety";
import Partner from "@/components/Partner";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <section id="paths" className="section-white">
          <div className="container">
            <Paths />
          </div>
        </section>
        <section id="services" className="section-white">
          <div className="container">
            <Services />
          </div>
        </section>
        <section id="studio" className="section-dark">
          <div className="container">
            <Planner />
          </div>
        </section>
        <section id="how" className="section-white">
          <div className="container">
            <HowItWorks />
          </div>
        </section>
        <section id="price" className="section-dark">
          <div className="container">
            <NameYourPrice />
          </div>
        </section>
        <section id="stylists" className="section-white">
          <div className="container">
            <Stylists />
          </div>
        </section>
        <section id="reviews" className="section-white">
          <div className="container">
            <Reviews />
          </div>
        </section>
        <section id="dashboard" className="section-dark">
          <div className="container">
            <Dashboard />
          </div>
        </section>
        <section id="safety" className="section-white">
          <div className="container">
            <Safety />
          </div>
        </section>
        <section id="partners" className="section-white">
          <div className="container">
            <Partner />
          </div>
        </section>
        <section id="faq" className="section-white">
          <div className="container">
            <Faq />
          </div>
        </section>
        <Footer />
      </main>
    </>
  );
}