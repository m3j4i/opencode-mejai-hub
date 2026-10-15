# Interface languages

Copy en.language to a new file such as pt-BR.language. Use UTF-8 JSON. Set name to the language name shown in the selector. Keep the keys in strings unchanged and translate their values, including button explanations. Preserve placeholders such as {name}, {count} and {files}.

In the Hub, select Scan languages to discover the new file without restarting. Invalid files are reported and skipped. Missing translations fall back to English. Model responses, user messages, filenames, logs and source code are not translated. The selected language is saved in this browser. Translation files must remain under 2 MB.

For contributors: update the English catalog whenever an interface phrase changes; do not insert translations into HTML. New chat modules use the translation helper directly. Legacy Hub controls also use the phrase catalog through the DOM adapter.
