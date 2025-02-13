import Header from "@/components/Layout/Header";

export default function Home() {
  return (
    <>
      <Header />
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <h1 className="text-6xl font-bold text-white">Aviator</h1>
      </div>
    </>
  );
}