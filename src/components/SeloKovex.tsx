// Selo "Desenvolvido por KOVEX" — rodapé dos apps da suíte.
//
// FONTE ÚNICA: C:\KOVEX\selo\SeloKovex.tsx. O que existe dentro de cada app é
// uma CÓPIA deste arquivo. Se o selo mudar, muda aqui e recopia — é o preço de
// os onze apps não compartilharem um pacote npm.
//
// Estilo inline de propósito: eles não compartilham Tailwind, tokens nem folha
// de estilo, e o selo tem de sair idêntico nos onze. A cor toda se resolve em
// currentColor, então o selo acompanha sozinho o tema (claro/escuro) do app que
// o hospeda — só a célula laranja da marca é fixa, porque é a marca.
//
// A tipografia NÃO herda a do app de propósito: uma pilha de sistema faz o selo
// ler igual nos onze, em vez de virar onze selos diferentes.

const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const ACENTO = '#F2621F';

const celula: React.CSSProperties = {
  border: '1.5px solid color-mix(in srgb, currentColor 45%, transparent)',
  borderRadius: 1,
};

export function SeloKovex({ semLinha = false }: { semLinha?: boolean } = {}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 16px',
        borderTop: semLinha ? undefined : '1px solid color-mix(in srgb, currentColor 10%, transparent)',
      }}
    >
      <a
        href="https://kovex.ia.br"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          textDecoration: 'none',
          color: 'inherit',
          fontFamily: FONTE,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 6px)',
            gridTemplateRows: 'repeat(2, 6px)',
            gap: 1.5,
            flex: 'none',
          }}
        >
          <span style={celula} />
          <span style={celula} />
          <span style={celula} />
          <span style={{ background: ACENTO, borderRadius: 1 }} />
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            color: 'color-mix(in srgb, currentColor 60%, transparent)',
          }}
        >
          Desenvolvido por <b style={{ fontWeight: 500, letterSpacing: '0.16em' }}>Kovex</b>
        </span>
      </a>
    </div>
  );
}

export default SeloKovex;
