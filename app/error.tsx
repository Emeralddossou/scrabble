'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="center-screen error-screen">
      <p className="eyebrow">OUILLE</p>
      <h1>La partie a rencontré un obstacle.</h1>
      <p>Vos actions validées restent enregistrées. Vous pouvez réessayer sans les rejouer.</p>
      <button type="button" onClick={reset}>
        Réessayer
      </button>
    </main>
  );
}
