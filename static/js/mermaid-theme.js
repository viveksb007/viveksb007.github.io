(() => {
    const palettes = {
        light: {
            background: '#ffffff', text: '#172b4d', line: '#52657d',
            node: '#eaf2ff', border: '#4475aa',
            cluster: '#f3f6fa', clusterBorder: '#b8c5d6',
            secondary: '#e6f5f0', note: '#fff4dc', noteBorder: '#a97825',
        },
        dark: {
            background: '#1d1e20', text: '#eef5ff', line: '#b3c4d9',
            node: '#1b3651', border: '#79b8f3',
            cluster: '#222b38', clusterBorder: '#61758e',
            secondary: '#173c36', note: '#3b3020', noteBorder: '#d7ad60',
        },
    };

    function start() {
        const diagrams = Array.from(document.querySelectorAll('.mermaid'), node => ({
            node,
            // Mermaid replaces its source with SVG. Keep the original, including
            // HTML labels, so a theme toggle can render it again.
            source: node.innerHTML,
        }));
        if (!diagrams.length || typeof mermaid === 'undefined') return;

        // PaperMod has already resolved saved preferences and the OS theme into
        // this body class. Consulting matchMedia again would override the user.
        const currentTheme = () => document.body.classList.contains('dark') ? 'dark' : 'light';
        let requestedTheme = currentTheme();
        let renderedTheme;
        let rendering = false;

        async function render() {
            if (rendering) return;
            rendering = true;
            try {
                // Serialize renders and pick up the latest selection if the user
                // toggles again while Mermaid is working.
                while (renderedTheme !== requestedTheme) {
                    const theme = requestedTheme;
                    const p = palettes[theme];
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: 'base',
                        securityLevel: 'loose',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        themeVariables: {
                            darkMode: theme === 'dark',
                            background: p.background,
                            primaryColor: p.node,
                            primaryTextColor: p.text,
                            primaryBorderColor: p.border,
                            secondaryColor: p.secondary,
                            secondaryTextColor: p.text,
                            tertiaryColor: p.cluster,
                            tertiaryTextColor: p.text,
                            textColor: p.text,
                            lineColor: p.line,
                            nodeTextColor: p.text,
                            clusterBkg: p.cluster,
                            clusterBorder: p.clusterBorder,
                            edgeLabelBackground: p.background,
                            titleColor: p.text,
                            actorBkg: p.node,
                            actorBorder: p.border,
                            actorTextColor: p.text,
                            actorLineColor: p.line,
                            signalColor: p.line,
                            signalTextColor: p.text,
                            labelBoxBkgColor: p.cluster,
                            labelBoxBorderColor: p.clusterBorder,
                            labelTextColor: p.text,
                            loopTextColor: p.text,
                            noteBkgColor: p.note,
                            noteBorderColor: p.noteBorder,
                            noteTextColor: p.text,
                            activationBkgColor: p.secondary,
                            activationBorderColor: p.border,
                            sequenceNumberColor: p.background,
                        },
                        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
                    });
                    for (const { node, source } of diagrams) {
                        node.innerHTML = source;
                        node.removeAttribute('data-processed');
                    }
                    await mermaid.run({ nodes: diagrams.map(({ node }) => node) });
                    renderedTheme = theme;
                }
            } catch (error) {
                console.error('Could not render Mermaid diagrams:', error);
            } finally {
                rendering = false;
            }
        }

        new MutationObserver(() => {
            requestedTheme = currentTheme();
            render();
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        render();
    }

    // Disable Mermaid's automatic pass before window.load; we own rendering.
    if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
