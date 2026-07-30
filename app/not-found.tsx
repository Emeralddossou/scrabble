import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <main className="center-screen error-screen">
      <p className="eyebrow">404</p>
      <h1>Cette case est introuvable.</h1>
      <p>Le lien a peut-être expiré ou la partie n’est plus accessible.</p>
      <Link className="button-link" href="/">
        Revenir à LexiForge
      </Link>
    </main>
  );
}
