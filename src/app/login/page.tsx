import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Login — EtiquetaMO',
  description: 'Acesse a área restrita do EtiquetaMO',
};

function LoginContent({ erro }: { erro?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffaf2', padding: '20px' }}>
      <div style={{ maxWidth: '400px', textAlign: 'center', background: '#fff', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '24px', color: '#000' }}>EtiquetaMO</h1>
        <p style={{ margin: '0 0 30px 0', fontSize: '14px', color: '#666' }}>Sistema de impressão de etiquetas</p>

        {erro === 'sem_acesso' && (
          <div style={{ background: '#fee', border: '1px solid #f31c40', borderRadius: '4px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: '#c00' }}>
            Seu perfil não tem acesso ao EtiquetaMO. Contate o gerente.
          </div>
        )}

        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>Use sua conta da Intranet para acessar</p>
        <a
          href="https://gelateriamoderna.com.br/intranet"
          style={{
            display: 'inline-block',
            background: '#f31c40',
            color: '#fff',
            padding: '12px 32px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Acessar Intranet
        </a>
      </div>
    </div>
  );
}

export default function LoginPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const erro = typeof searchParams.erro === 'string' ? searchParams.erro : undefined;

  return (
    <Suspense fallback={<LoginContent />}>
      <LoginContent erro={erro} />
    </Suspense>
  );
}
