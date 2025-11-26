import { NextPage } from 'next';

interface ErrorProps {
  statusCode?: number;
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
          {statusCode ? `Error ${statusCode}` : 'An error occurred'}
        </h1>
        <p style={{ marginTop: '0.5rem', color: '#6B7280' }}>
          {statusCode === 404 ? 'Page not found' : 'Sorry, something went wrong'}
        </p>
        <a
          href="/"
          style={{
            marginTop: '1rem',
            display: 'inline-block',
            color: '#2563EB',
            textDecoration: 'none',
          }}
        >
          Go back home
        </a>
      </div>
    </div>
  );
};

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
