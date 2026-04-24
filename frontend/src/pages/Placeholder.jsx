export default function Placeholder({ title, description }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-2">
        {description || 'Módulo planificado — se implementa en una fase posterior.'}
      </p>
    </div>
  );
}
