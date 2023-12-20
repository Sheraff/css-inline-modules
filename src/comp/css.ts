type ClassStart = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type NonClass = '.' | '#' | ' ' | '~' | '\\' | '!' | '@' | '$' | '%' | '^' | '&' | '*' | '(' | ')' | '+' | '=' | ',' | '/' | "'" | ';' | ':' | '"' | '?' | '>' | '<' | '[' | ']' | '{' | '}' | '|' | '`' | '\t' | '\n' | '\r'
type Classes<raw extends string> = raw extends `${string}.${infer className}${infer end extends NonClass}${infer tail}`
	? end extends '.'
	? [className, ...Classes<`.${tail}`>]
	: [className, ...Classes<tail>]
	: []

type Bibi<raw extends string> = raw extends `${infer classPart}${infer tail}`
	? tail extends `${NonClass}${string}`
	? classPart
	: `${classPart}${Bibi<tail>}`
	: never

type Alt<raw extends string, mode extends boolean = false> = mode extends false
	? raw extends `${string}.${infer tail}`
	? tail extends `${ClassStart}${string}`
	? Alt<tail, true>
	: Alt<tail, false>
	: []
	: raw extends `${Bibi<raw>}${infer rest}`
	? [Bibi<raw>, ...Alt<rest, false>]
	: []


export function css<const T extends TemplateStringsArray>(string: T): Record<string, string>
export function css<const T extends string>(string: T): Record<Alt<T>[number], string>
export function css<T>(string: T): Record<string, string> {
	return {}
}