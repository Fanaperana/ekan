use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use regex::Regex;

const ICON_LIST: &str = r#"<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" aria-hidden="true" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clip-rule="evenodd"></path><path fill-rule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zM6 12a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V12zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 15a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V15zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 18a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V18zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75z" clip-rule="evenodd"></path></svg>"#;
const ICON_CHECK: &str = r#"<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" aria-hidden="true" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clip-rule="evenodd"></path><path fill-rule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zm9.586 4.594a.75.75 0 00-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.116-.062l3-3.75z" clip-rule="evenodd"></path></svg>"#;

struct MarkdownProcessor {
    input_pattern: Regex,
}

impl MarkdownProcessor {
    fn new() -> Self {
        Self {
            input_pattern: Regex::new(r"i::\[(\w+)\((.+?)\)\]").unwrap(),
        }
    }

    fn create_input_element(&self, input_type: &str, value: &str) -> String {
        match input_type {
            "text" | "password" => {
                let onclick_handler = format!(
                    r#"
                        navigator.clipboard.writeText('{}');
                        this.innerHTML = '{}';
                        setTimeout(() => {{
                            this.innerHTML = '{}';
                        }}, 3000);
                    "#,
                    value,
                    ICON_CHECK.replace('\'', "\\'").replace('"', "&quot;"),
                    ICON_LIST.replace('\'', "\\'").replace('"', "&quot;")
                );

                format!(
                    r#"<div class="flex flex-row custom-input">
                        <input type="{}" class="text-xs w-full bg-slate-700 rounded-l py-1" value="{}" disabled />
                        <button 
                            class="p-1 border border-slate-500 bg-slate-600 border-l-0 rounded-r hover:bg-slate-700" 
                            data-value="{}"
                            onclick="{}"
                        >{}</button>
                    </div>"#,
                    input_type,
                    value,
                    value,
                    onclick_handler.replace('"', "&quot;"),
                    ICON_LIST
                )
            }
            _ => {
                format!(
                    r#"<div class="flex flex-row custom-input">
                        <input type="{}" class="text-xs w-full bg-slate-700 rounded py-1" value="{}" disabled />
                    </div>"#,
                    input_type, value
                )
            }
        }
    }

    fn process_custom_input(&self, text: &str) -> String {
        if let Some(captures) = self.input_pattern.captures(text) {
            let input_type = captures.get(1).map_or("", |m| m.as_str());
            let value = captures.get(2).map_or("", |m| m.as_str());
            self.create_input_element(input_type, value)
        } else {
            text.to_string()
        }
    }

    fn process_markdown(&self, md: &str) -> String {
        let mut options = Options::empty();
        options.insert(Options::ENABLE_STRIKETHROUGH);

        let parser = Parser::new_ext(md, options);
        let mut output = String::new();
        let mut current_paragraph = String::new();

        for event in parser {
            match event {
                Event::Text(text) => {
                    current_paragraph.push_str(&text);
                }
                Event::Start(Tag::Paragraph) => {
                    output.push_str("<p>");
                }
                Event::End(TagEnd::Paragraph) => {
                    output.push_str(&self.process_custom_input(&current_paragraph));
                    output.push_str("</p>");
                    current_paragraph.clear();
                }
                _ => {
                    if !current_paragraph.is_empty() {
                        output.push_str(&self.process_custom_input(&current_paragraph));
                        current_paragraph.clear();
                    }
                    let mut html_output = String::new();
                    pulldown_cmark::html::push_html(&mut html_output, std::iter::once(event));
                    output.push_str(&html_output);
                }
            }
        }

        if !current_paragraph.is_empty() {
            output.push_str(&self.process_custom_input(&current_paragraph));
        }

        output
    }
}

#[tauri::command]
pub fn process_markdown(md: &str) -> String {
    let processor = MarkdownProcessor::new();
    processor.process_markdown(md)
}
