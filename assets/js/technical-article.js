(() => {
  const article = document.querySelector('.technical-article');
  if (!article) return;

  const body = article.querySelector('.technical-article__body');
  const contents = article.querySelector('.technical-article__toc');
  if (contents) {
    const list = contents.querySelector('ol');
    const headings = body.querySelectorAll('h2[id]');
    headings.forEach(heading => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + encodeURIComponent(heading.id);
      link.textContent = heading.textContent;
      item.append(link);
      list.append(item);
    });
    contents.hidden = headings.length === 0;
  }

  body.querySelectorAll('table').forEach(table => {
    const region = document.createElement('div');
    region.className = 'technical-article__table';
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', table.caption?.textContent.trim() || 'Scrollable table');
    table.before(region);
    region.append(table);
  });

  const components = {
    slider(block) {
      const input = block.querySelector('input');
      const output = block.querySelector('output');
      input.addEventListener('input', () => { output.value = input.value; });
      input.disabled = false;
    }
  };

  body.querySelectorAll('[data-article-component]').forEach(block => {
    const name = block.dataset.articleComponent;
    if (Object.prototype.hasOwnProperty.call(components, name)) components[name](block);
  });
})();
