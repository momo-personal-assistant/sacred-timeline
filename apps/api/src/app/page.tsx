export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Unified Memory API</h1>
      <p>Status: Running</p>
      <ul>
        <li>
          <a href="/api/health">Health Check</a>
        </li>
        <li>
          <a href="/api/memory">Memory Endpoints</a>
        </li>
      </ul>
    </main>
  );
}
