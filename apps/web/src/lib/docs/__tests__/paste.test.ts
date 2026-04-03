import { normalizeDocumentPasteHtml, normalizeDocumentPasteText } from '../paste';

describe('docs paste helpers', () => {
  it('normalizes pasted plain text', () => {
    expect(normalizeDocumentPasteText('  First line\r\n\r\nSecond\u00a0line\u200b\r\n\r\n\r\nThird  ')).toBe(
      'First line\n\nSecond line\n\nThird'
    );
  });

  it('keeps meaningful formatting while stripping noisy wrapper markup', () => {
    const html = normalizeDocumentPasteHtml(`
      <!--StartFragment-->
      <div class="wrapper" data-id="123">
        <span style="font-weight:700">Bold</span>
        <span style="font-style:italic; text-decoration: underline;">Layered</span>
        <script>alert('x')</script>
      </div>
      <!--EndFragment-->
    `);

    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.body.querySelector('p')).not.toBeNull();
    expect(doc.body.querySelector('strong')?.textContent).toBe('Bold');
    expect(doc.body.querySelector('em u')?.textContent).toBe('Layered');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('class=');
    expect(html).not.toContain('data-id=');
  });

  it('preserves safe structure and removes unsafe links', () => {
    const html = normalizeDocumentPasteHtml(`
      <div>
        <h5 style="text-align:center">Imported heading</h5>
        <table>
          <tr><th>Col</th></tr>
          <tr><td>Value</td></tr>
        </table>
        <a href="javascript:alert(1)" class="bad-link">Bad link</a>
        <a href="https://example.com/page" style="color:red">Good link</a>
      </div>
    `);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const heading = doc.body.querySelector('h3');
    const links = doc.body.querySelectorAll('a');

    expect(heading?.textContent).toBe('Imported heading');
    expect(heading?.getAttribute('style')).toBe('text-align: center');
    expect(doc.body.querySelector('table')).not.toBeNull();
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('https://example.com/page');
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain('class=');
  });
});
