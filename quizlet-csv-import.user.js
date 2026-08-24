// ==UserScript==
// @name         happymonkey1@'s Quizlet CSV Import
// @namespace    happymonkey1-quizlet-csv-import
// @author       happymonkey1@kablunk.com
// @version      1.6.2
// @description  Import CSV files into Quizlet's native bulk importer
// @match        https://quizlet.com/*
// @run-at       document-idle
// @grant        none
// @supportURL   https://www.kablunk.com/contact
// @homepageURL  https://github.com/happymonkey1/quizlet-userscripts
// @updateURL    https://github.com/happymonkey1/quizlet-userscripts/raw/refs/heads/mainline/quizlet-csv-import.user.js
// @downloadURL  https://github.com/happymonkey1/quizlet-userscripts/raw/refs/heads/mainline/quizlet-csv-import.user.js
// ==/UserScript==

(() => {
    'use strict';

    const VERSION = '1.6.2';
    const PREFIX = `[happymonkey1@\'s Quizlet CSV Import v${VERSION}]`;
    const BUTTON_ID = 'tm-quizlet-csv-import';
    const CARD_DELIMITER = '<<<QUIZLET_CARD_BREAK>>>';

    console.log(`${PREFIX} loaded`, location.href);

    function parseCsv(text) {
        text = text.replace(/^\uFEFF/, '');

        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (quoted) {
                if (ch === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field += ch;
                }
                continue;
            }

            if (ch === '"') {
                quoted = true;
            } else if (ch === ',') {
                row.push(field);
                field = '';
            } else if (ch === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else if (ch !== '\r') {
                field += ch;
            }
        }

        if (quoted) {
            throw new Error('CSV contains an unterminated quoted field.');
        }

        row.push(field);

        if (
            row.length > 1 ||
            row.some(value => String(value ?? '').trim() !== '')
        ) {
            rows.push(row);
        }

        return rows;
    }

    function normalizeHeader(value) {
        return String(value ?? '').trim().toLowerCase();
    }

    function normalizeCell(value) {
        return String(value ?? '')
            .replace(/\r\n?/g, '\n')
            .replace(/\t/g, ' ')
            .trim();
    }

    function formatDefinition(value) {
        let text = normalizeCell(value);

        // "Why the Other Answers Are Wrong" heading is not required.
        // Best effort find to use as a formatting hint.
        text = text.replace(
            /[ \t]*(Why\s+(?:the\s+)?Other\s+Answers?\s+Are\s+Wrong:?)[ \t]*/gi,
            '\n\n$1\n\n'
        );

        // Find emphasized answer labels and create a new paragraph.
        text = text.replace(
            /[ \t]+(?=(?:\*{1,2})[A-H]\.\s)/g,
            '\n\n'
        );

        // Give emphasized answer labels that already start a line a blank
        // line before them.
        text = text.replace(
            /\n(?=(?:\*{1,2})[A-H]\.\s)/g,
            '\n\n'
        );

        // Extracts explanation followed by a bold/italic answer on the same line
        // into a explanation separated by a new line.
        text = text.replace(
            /((\*{1,2})[A-H]\.\s+[^\n]*?\2)[ \t]+(?=\S)/g,
            '$1\n'
        );

        return text
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function csvToQuizletText(csvText) {
        let rows = parseCsv(csvText);

        rows = rows.filter(row =>
            row.some(value => String(value ?? '').trim() !== '')
        );

        if (!rows.length) {
            throw new Error('CSV contains no rows.');
        }

        const termHeaders = new Set([
            'term',
            'front',
            'question',
            'prompt',
            'word'
        ]);

        const definitionHeaders = new Set([
            'definition',
            'back',
            'answer',
            'response',
            'meaning'
        ]);

        const firstRow = rows[0].map(normalizeHeader);

        let termColumn = firstRow.findIndex(value =>
            termHeaders.has(value)
        );

        let definitionColumn = firstRow.findIndex(value =>
            definitionHeaders.has(value)
        );

        let firstDataRow = 0;

        if (termColumn !== -1 && definitionColumn !== -1) {
            firstDataRow = 1;
            console.log(`${PREFIX} detected header row`, rows[0]);
        } else {
            termColumn = 0;
            definitionColumn = 1;
            console.log(
                `${PREFIX} no recognized headers; using columns 1 and 2`
            );
        }

        const cards = [];

        for (let i = firstDataRow; i < rows.length; i++) {
            const row = rows[i];

            if (
                row.length <= Math.max(termColumn, definitionColumn)
            ) {
                console.warn(
                    `${PREFIX} skipping row ${i + 1}; not enough columns`,
                    row
                );
                continue;
            }

            const term = normalizeCell(row[termColumn]);
            const definition = formatDefinition(
                row[definitionColumn]
            );

            if (!term && !definition) {
                continue;
            }

            if (!term || !definition) {
                console.warn(
                    `${PREFIX} row ${i + 1} has an empty field`,
                    row
                );
            }

            cards.push(`${term}\t${definition}`);
        }

        if (!cards.length) {
            throw new Error(
                'No flashcards could be extracted from the CSV.'
            );
        }

        return {
            text: cards.join(CARD_DELIMITER),
            count: cards.length
        };
    }

    function isVisible(element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }

    function findNativeImportButton() {
        return [...document.querySelectorAll('button')]
            .find(button =>
                isVisible(button) &&
                button.textContent?.trim().toLowerCase() === 'import'
            ) ?? null;
    }

    function findImportTextarea() {
        return document.querySelector(
            'textarea[placeholder^="Word 1"]'
        );
    }

    function waitForImportTextarea(timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            const existing = findImportTextarea();

            if (existing) {
                resolve(existing);
                return;
            }

            const observer = new MutationObserver(() => {
                const textarea = findImportTextarea();

                if (textarea) {
                    observer.disconnect();
                    clearTimeout(timeout);
                    resolve(textarea);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            const timeout = setTimeout(() => {
                observer.disconnect();
                reject(
                    new Error(
                        'Quizlet import dialog did not appear.'
                    )
                );
            }, timeoutMs);
        });
    }

    function findAssociatedRadio(element) {
        let node = element.parentElement;

        while (node && node !== document.body) {
            const radios = [
                ...node.querySelectorAll('input[type="radio"]')
            ];

            if (radios.length === 1) {
                return radios[0];
            }

            node = node.parentElement;
        }

        return null;
    }

    function configureQuizletTermDelimiter() {
        const radios = [
            ...document.querySelectorAll('input[type="radio"]')
        ];

        const tabRadio = radios.find(radio => {
            let node = radio.parentElement;

            for (let depth = 0; depth < 4 && node; depth++) {
                if (
                    node.textContent
                        ?.replace(/\s+/g, ' ')
                        .trim()
                        .toLowerCase() === 'tab'
                ) {
                    return true;
                }

                node = node.parentElement;
            }

            return false;
        });

        if (!tabRadio) {
            throw new Error(
                'Could not find Quizlet Tab delimiter option.'
            );
        }

        if (!tabRadio.checked) {
            tabRadio.click();
        }
    }

    function configureQuizletCardDelimiter() {
        const customInputs = [
            ...document.querySelectorAll(
                'input[aria-label="Custom"]'
            )
        ];

        const customInput =
            customInputs.find(
                input =>
                    input.getAttribute('placeholder') === '\\n\\n'
            ) ??
            customInputs.at(-1) ??
            null;

        if (!customInput) {
            throw new Error(
                'Could not find Quizlet custom card delimiter input.'
            );
        }

        const radio = findAssociatedRadio(customInput);

        if (!radio) {
            throw new Error(
                'Could not find Quizlet custom delimiter radio button.'
            );
        }

        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        )?.set;

        if (!setter) {
            throw new Error(
                'Could not set Quizlet custom delimiter input.'
            );
        }

        setter.call(customInput, CARD_DELIMITER);

        customInput.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: CARD_DELIMITER
            })
        );

        customInput.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

        if (!radio.checked) {
            radio.click();
        }
    }

    function setReactTextareaValue(textarea, value) {
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value'
        )?.set;

        if (!setter) {
            throw new Error(
                'Could not set Quizlet import textarea.'
            );
        }

        setter.call(textarea, value);

        textarea.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: value
            })
        );

        textarea.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

        textarea.focus();
    }

    function findPreviewHeading() {
        return [...document.querySelectorAll('h1, h2, h3, h4')]
            .find(element => {
                const text = element.textContent
                    ?.replace(/\s+/g, ' ')
                    .trim();

                return /^Preview\s+\d+\s+cards?$/i.test(text ?? '');
            }) ?? null;
    }

    function findScrollableDescendant(root) {
        const rootRect = root.getBoundingClientRect();

        return [
            root,
            ...root.querySelectorAll('*')
        ]
            .filter(element => {
                if (!isVisible(element)) {
                    return false;
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return (
                    /auto|scroll/.test(style.overflowY) &&
                    rect.width >= rootRect.width * 0.75 &&
                    rect.height >= 80
                );
            })
            .sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();

                return (
                    bRect.width - aRect.width ||
                    bRect.height - aRect.height
                );
            })[0] ?? null;
    }

    function findQuizletPreviewContainer() {
        const heading = findPreviewHeading();

        if (!heading) {
            return null;
        }

        // Try find node by walking up.
        let node = heading;
        for (let depth = 0; depth < 5 && node; depth++) {
            let sibling = node.nextElementSibling;

            while (sibling) {
                if (isVisible(sibling)) {
                    const rect = sibling.getBoundingClientRect();

                    if (
                        rect.width >= window.innerWidth * 0.45 &&
                        rect.height >= 80
                    ) {
                        return {
                            root: sibling,
                            scroller:
                                findScrollableDescendant(sibling) ??
                                sibling
                        };
                    }
                }

                sibling = sibling.nextElementSibling;
            }

            node = node.parentElement;
        }

        // Try find scrollable element below the preview heading.
        const scope =
            heading.closest(
                '[role="dialog"], [aria-modal="true"]'
            ) ??
            document.body;

        const headingRect = heading.getBoundingClientRect();

        const candidate = [...scope.querySelectorAll('*')]
            .filter(element => {
                if (!isVisible(element)) {
                    return false;
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return (
                    /auto|scroll/.test(style.overflowY) &&
                    rect.top >= headingRect.bottom - 8 &&
                    rect.top <= headingRect.bottom + 120 &&
                    rect.width >= window.innerWidth * 0.45 &&
                    rect.height >= 80
                );
            })
            .sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();

                return (
                    Math.abs(aRect.top - headingRect.bottom) -
                    Math.abs(bRect.top - headingRect.bottom) ||
                    bRect.width - aRect.width
                );
            })[0];

        return candidate
            ? { root: candidate, scroller: candidate }
            : null;
    }

    function enlargeQuizletPreview() {
        const preview = findQuizletPreviewContainer();

        if (!preview) {
            console.warn(
                `${PREFIX} could not identify Quizlet preview container`
            );
            return;
        }

        const rootRect = preview.root.getBoundingClientRect();

        const availableHeight = Math.max(
            280,
            window.innerHeight - rootRect.top - 90
        );

        const targetHeight = Math.round(
            Math.min(
                window.innerHeight * 0.58,
                availableHeight
            )
        );

        preview.root.style.setProperty(
            'height',
            `${targetHeight}px`,
            'important'
        );

        preview.root.style.setProperty(
            'min-height',
            `${targetHeight}px`,
            'important'
        );

        preview.root.style.setProperty(
            'max-height',
            'none',
            'important'
        );

        if (preview.scroller !== preview.root) {
            preview.scroller.style.setProperty(
                'height',
                '100%',
                'important'
            );

            preview.scroller.style.setProperty(
                'min-height',
                '100%',
                'important'
            );

            preview.scroller.style.setProperty(
                'max-height',
                'none',
                'important'
            );
        } else {
            preview.root.style.setProperty(
                'overflow-y',
                'auto',
                'important'
            );
        }
    }

    let previewResizeTimer = null;

    function schedulePreviewResize() {
        clearTimeout(previewResizeTimer);

        previewResizeTimer = setTimeout(
            enlargeQuizletPreview,
            50
        );
    }

    function chooseFile() {
        return new Promise(resolve => {
            const input = document.createElement('input');

            input.type = 'file';
            input.accept = '.csv,text/csv';

            input.addEventListener(
                'change',
                () => resolve(input.files?.[0] ?? null),
                { once: true }
            );

            input.click();
        });
    }

    async function doImport() {
        try {
            const file = await chooseFile();

            if (!file) {
                return;
            }

            console.log(
                `${PREFIX} selected file`,
                file.name,
                file.size
            );

            const csvText = await file.text();
            const result = csvToQuizletText(csvText);

            console.log(
                `${PREFIX} parsed ${result.count} cards`
            );

            let textarea = findImportTextarea();

            if (!textarea) {
                const nativeImport = findNativeImportButton();

                if (!nativeImport) {
                    throw new Error(
                        'Could not find Quizlet\'s Import button.'
                    );
                }

                nativeImport.click();
                textarea = await waitForImportTextarea();
            }

            configureQuizletTermDelimiter();
            configureQuizletCardDelimiter();
            setReactTextareaValue(textarea, result.text);

            // Quizlet updates the preview asynchronously.
            requestAnimationFrame(schedulePreviewResize);
            setTimeout(schedulePreviewResize, 150);
            setTimeout(schedulePreviewResize, 600);

            console.log(
                `${PREFIX} successfully loaded ${result.count} cards`
            );
        } catch (error) {
            console.error(PREFIX, error);

            alert(
                `Quizlet CSV Import\n\n${error?.message ?? error}`
            );
        }
    }

    function createButton(nativeImportButton) {
        if (document.getElementById(BUTTON_ID)) {
            return;
        }

        const button = document.createElement('button');

        button.id = BUTTON_ID;
        button.type = 'button';

        const quizletIcon =
            nativeImportButton.querySelector('svg');

        if (quizletIcon) {
            const icon = quizletIcon.cloneNode(true);
            icon.removeAttribute('id');
            button.appendChild(icon);
        } else {
            const fallbackIcon = document.createElement('span');
            fallbackIcon.textContent = '+';
            button.appendChild(fallbackIcon);
        }

        const label = document.createElement('span');
        label.textContent = 'Import CSV';
        button.appendChild(label);

        Object.assign(button.style, {
            border: '0',
            borderRadius: '999px',
            padding: '10px 18px',
            marginLeft: '12px',
            background: '#4255ff',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
        });

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            doImport();
        });

        nativeImportButton.insertAdjacentElement(
            'afterend',
            button
        );

        console.log(`${PREFIX} added Import CSV button`);
    }

    function install() {
        const nativeImport = findNativeImportButton();

        if (nativeImport) {
            createButton(nativeImport);
        }
    }

    install();

    const observer = new MutationObserver(() => {
        install();

        if (findImportTextarea()) {
            schedulePreviewResize();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener('resize', () => {
        if (findImportTextarea()) {
            schedulePreviewResize();
        }
    });

    setInterval(install, 2000);
})();