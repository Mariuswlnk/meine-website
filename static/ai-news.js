(() => {
    const endpoint = '/api/ai-news';
    const feedMeta = document.getElementById('feed-meta');
    const leadStory = document.getElementById('lead-story');
    const newsList = document.getElementById('news-list');
    const template = document.getElementById('news-card-template');
    const errorBox = document.getElementById('news-error');
    const refreshButton = document.getElementById('refresh-button');
    let currentCategory = 'all';

    const formatDate = (value) => {
        if (!value) return 'Gerade eben';
        const date = new Date(value);
        const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
        if (diffMinutes < 60) return `vor ${Math.max(1, diffMinutes)} Min.`;
        if (diffMinutes < 1440) return `vor ${Math.round(diffMinutes / 60)} Std.`;
        return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(date);
    };

    const writeLead = (article) => {
        leadStory.classList.remove('story-skeleton');
        leadStory.querySelector('.story-number').textContent = '01 / TOP STORY';
        leadStory.querySelector('.source-line').textContent = `${article.source} / ${formatDate(article.published_at)}`;
        leadStory.querySelector('h2').textContent = article.title;
        leadStory.querySelector('.story-description').textContent = article.description || 'Aktuelle Meldung aus dem AI-Ökosystem.';
        const link = leadStory.querySelector('.story-arrow');
        link.href = article.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    };

    const addCard = (article) => {
        const card = template.content.cloneNode(true);
        const root = card.querySelector('.news-card');
        root.querySelector('.source-line').textContent = article.source;
        root.querySelector('h2').textContent = article.title;
        root.querySelector('time').textContent = formatDate(article.published_at);
        const link = root.querySelector('a');
        link.href = article.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        newsList.appendChild(card);
    };

    const loadNews = async () => {
        refreshButton.disabled = true;
        errorBox.hidden = true;
        feedMeta.textContent = 'Aktualisiere den Live-Feed ...';
        try {
            const response = await fetch(`${endpoint}?category=${encodeURIComponent(currentCategory)}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.articles?.length) throw new Error(data.error || 'Keine Artikel gefunden');
            writeLead(data.articles[0]);
            newsList.replaceChildren();
            data.articles.slice(1, 9).forEach(addCard);
            feedMeta.textContent = `${data.articles.length} Meldungen · aktualisiert ${new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
        } catch (error) {
            feedMeta.textContent = 'Feed momentan nicht verfügbar';
            errorBox.hidden = false;
        } finally {
            refreshButton.disabled = false;
        }
    };

    document.querySelectorAll('.topic-button').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelector('.topic-button.is-active')?.classList.remove('is-active');
            button.classList.add('is-active');
            currentCategory = button.dataset.category;
            loadNews();
        });
    });

    refreshButton.addEventListener('click', loadNews);
    document.getElementById('retry-button').addEventListener('click', loadNews);
    document.getElementById('footer-date').textContent = new Intl.DateTimeFormat('de-DE', { year: 'numeric' }).format(new Date());
    loadNews();
})();
