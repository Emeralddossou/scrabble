export default function OfflinePage(): React.JSX.Element {
  return (
    <main className="center-screen">
      <section className="auth-panel">
        <p className="eyebrow">HORS CONNEXION</p>
        <h1>La partie reste visible.</h1>
        <p>Reconnectez-vous pour récupérer l’état serveur avant de valider un nouveau coup.</p>
      </section>
    </main>
  );
}
