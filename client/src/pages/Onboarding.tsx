import { UptrailLogo } from "@/components/UptrailLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { countryProfiles, careers } from "@shared/careerData";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Globe2, MapPin, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const skillChoices = ["HTML & CSS", "JavaScript", "Git & GitHub", "Figma", "SQL", "Python", "Communication", "Spreadsheet Analysis"];
const currentRoles = ["Student", "Recent graduate", "Early-career professional", "Career switcher", "Working professional"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState("IN");
  const [role, setRole] = useState("Student");
  const [career, setCareer] = useState("frontend-developer");
  const [experience, setExperience] = useState("0–1 years");
  const [skills, setSkills] = useState<string[]>(["HTML & CSS", "JavaScript"]);
  const [location, setWorkLocation] = useState("");
  const [workStyle, setWorkStyle] = useState("Hybrid");
  const selectedCountry = useMemo(() => countryProfiles.find((profile) => profile.code === country) ?? countryProfiles[0], [country]);
  const selectedCareer = careers.find((item) => item.slug === career) ?? careers[0];
  const progress = (step / 3) * 100;

  function toggleSkill(skill: string) {
    setSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]);
  }

  function continueFlow() {
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }
    toast.success("Your career map is ready to explore.");
    setLocation("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#F7F6F0] px-4 py-5 text-[#1D2927] sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <button onClick={() => step === 1 ? setLocation("/") : setStep((current) => current - 1)} className="group flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[#51615C] transition-colors hover:bg-white" aria-label={step === 1 ? "Return home" : "Previous step"}>
            <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">{step === 1 ? "Back to home" : "Previous step"}</span>
          </button>
          <UptrailLogo />
          <button onClick={() => setLocation("/dashboard")} className="rounded-xl px-3 py-2 text-sm font-semibold text-[#51615C] transition-colors hover:bg-white">Skip for now</button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-12">
          <aside className="order-2 rounded-[2rem] bg-[#18302F] p-7 text-white shadow-[0_26px_70px_rgba(24,48,47,0.16)] lg:order-1 lg:p-10">
            <Badge className="border-0 bg-white/10 px-3 py-1 text-xs font-semibold text-[#F4D793] hover:bg-white/10">YOUR CAREER, WITH CONTEXT</Badge>
            <h1 className="mt-6 max-w-md font-display text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-5xl">A path shaped around where you are.</h1>
            <p className="mt-5 max-w-md text-[0.96rem] leading-7 text-white/68">Answer a few focused questions. Uptrail will translate your experience, location, and goals into a route you can act on.</p>
            <div className="mt-10 space-y-4">
              {[
                ["01", "Your context", "Role, experience, and region"],
                ["02", "Your direction", "A target that feels worthwhile"],
                ["03", "Your starting point", "Skills you can build from"],
              ].map(([number, title, description], index) => (
                <div key={number} className={`flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors ${step === index + 1 ? "bg-white/10" : "opacity-45"}`}>
                  <div className={`grid size-9 place-items-center rounded-xl text-xs font-bold ${step === index + 1 ? "bg-[#F4D793] text-[#18302F]" : "bg-white/10 text-white"}`}>{step > index + 1 ? <Check className="size-4" /> : number}</div>
                  <div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-white/60">{description}</p></div>
                </div>
              ))}
            </div>
          </aside>

          <section className="order-1 rounded-[2rem] border border-[#E9E6DA] bg-white p-6 shadow-[0_18px_45px_rgba(42,56,48,0.06)] sm:p-9 lg:order-2 lg:p-11">
            <div className="flex items-center justify-between gap-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6C7B75]">Set up your route</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.045em] text-[#1D2927]">{step === 1 ? "Start with your context" : step === 2 ? "Choose a direction" : "Show us your starting point"}</h2></div>
              <span className="shrink-0 text-sm font-bold text-[#1F6B5B]">{step} / 3</span>
            </div>
            <Progress value={progress} className="mt-7 h-1.5 bg-[#E7EEE9] [&>div]:bg-[#1F6B5B]" />

            {step === 1 && <div className="mt-9 grid gap-7">
              <label className="grid gap-2 text-sm font-semibold">Where are you based?
                <div className="grid gap-3 sm:grid-cols-2">
                  {countryProfiles.slice(0, 4).map((profile) => <button key={profile.code} type="button" onClick={() => setCountry(profile.code)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${country === profile.code ? "border-[#1F6B5B] bg-[#F1F8F5] shadow-sm" : "border-[#E8E9E3] hover:border-[#BFCFC7]"}`}><Globe2 className={`size-5 ${country === profile.code ? "text-[#1F6B5B]" : "text-[#8B9690]"}`} /><span><span className="block text-sm font-bold">{profile.name}</span><span className="mt-0.5 block text-xs font-normal text-[#6C7B75]">{profile.currency} · {profile.educationSystem.split(",")[0]}</span></span></button>)}
                </div>
              </label>
              <label className="grid gap-2 text-sm font-semibold">Which description fits today?
                <div className="flex flex-wrap gap-2">{currentRoles.map((item) => <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-full border px-4 py-2 text-sm transition-all ${role === item ? "border-[#18302F] bg-[#18302F] text-white" : "border-[#DDE3DD] text-[#51615C] hover:border-[#18302F]"}`}>{item}</button>)}</div>
              </label>
              <label className="grid gap-2 text-sm font-semibold">Your {selectedCountry.locationLabel.toLowerCase()} <span className="font-normal text-[#89938E]">(optional)</span>
                <div className="relative"><MapPin className="absolute left-3 top-3 size-4 text-[#6C7B75]" /><Input value={location} onChange={(event) => setWorkLocation(event.target.value)} placeholder="e.g. Bengaluru, London, Toronto" className="h-11 rounded-xl border-[#DDE3DD] pl-9" /></div>
              </label>
              <label className="grid gap-2 text-sm font-semibold">Preferred work style <span className="font-normal text-[#89938E]">(optional)</span>
                <div className="flex flex-wrap gap-2">{["Remote", "Hybrid", "On-site", "Flexible"].map((item) => <button key={item} type="button" onClick={() => setWorkStyle(item)} className={`rounded-full border px-4 py-2 text-sm transition-all ${workStyle === item ? "border-[#18302F] bg-[#18302F] text-white" : "border-[#DDE3DD] text-[#51615C] hover:border-[#18302F]"}`}>{item}</button>)}</div>
              </label>
            </div>}

            {step === 2 && <div className="mt-9 grid gap-4">
              <p className="text-sm leading-6 text-[#66746E]">You can change your destination any time. Uptrail recalculates the route without losing your progress.</p>
              <div className="grid gap-3 sm:grid-cols-2">{careers.map((item) => <button key={item.slug} type="button" onClick={() => setCareer(item.slug)} className={`group rounded-2xl border p-4 text-left transition-all ${career === item.slug ? "border-[#1F6B5B] bg-[#F1F8F5] shadow-sm" : "border-[#E8E9E3] hover:-translate-y-0.5 hover:border-[#BFCFC7]"}`}><div className="flex items-start justify-between gap-2"><span className="grid size-9 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: item.accent }}>{item.title.slice(0, 1)}</span>{career === item.slug && <Check className="size-5 text-[#1F6B5B]" />}</div><p className="mt-4 text-sm font-bold">{item.title}</p><p className="mt-1 text-xs leading-5 text-[#6C7B75]">{item.family} · {item.demand} outlook</p></button>)}</div>
              <label className="mt-2 grid gap-2 text-sm font-semibold">Experience so far
                <div className="flex flex-wrap gap-2">{["0–1 years", "1–3 years", "3–5 years", "5+ years"].map((item) => <button key={item} type="button" onClick={() => setExperience(item)} className={`rounded-full border px-4 py-2 text-sm transition-all ${experience === item ? "border-[#18302F] bg-[#18302F] text-white" : "border-[#DDE3DD] text-[#51615C] hover:border-[#18302F]"}`}>{item}</button>)}</div>
              </label>
            </div>}

            {step === 3 && <div className="mt-9 grid gap-7">
              <div><p className="text-sm font-semibold">Select skills you already use</p><p className="mt-1 text-sm leading-6 text-[#6C7B75]">A self-rating is a start. Later, assessments and projects can strengthen your skill confidence.</p><div className="mt-5 flex flex-wrap gap-2">{skillChoices.map((skill) => <button key={skill} type="button" onClick={() => toggleSkill(skill)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${skills.includes(skill) ? "border-[#1F6B5B] bg-[#1F6B5B] text-white" : "border-[#DDE3DD] text-[#51615C] hover:border-[#1F6B5B]"}`}>{skills.includes(skill) && <Check className="mr-1.5 inline size-3.5" />}{skill}</button>)}</div></div>
              <div className="rounded-2xl bg-[#F7F6F0] p-5"><div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F4D793] text-[#18302F]"><Sparkles className="size-4" /></div><div><p className="text-sm font-bold">Your first route preview</p><p className="mt-1 text-sm leading-6 text-[#65736D]">{selectedCareer.title} · {selectedCareer.requiredSkills.length} core skills · personalized for {role.toLowerCase()} experience · {workStyle.toLowerCase()} preference.</p></div></div></div>
            </div>}

            <div className="mt-10 flex items-center justify-between gap-4 border-t border-[#EFF0EC] pt-6">
              <p className="text-xs leading-5 text-[#84908B]">You can complete optional details from your profile later.</p>
              <Button onClick={continueFlow} className="h-11 rounded-xl bg-[#18302F] px-5 font-semibold text-white shadow-[0_9px_20px_rgba(24,48,47,0.18)] hover:bg-[#244442]">{step === 3 ? "Build my route" : "Continue"}<ArrowRight className="ml-2 size-4" /></Button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
