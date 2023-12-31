import { type CSSProperties } from "react"
import { css, inline } from "./css"
import styles from "./Foo.module.css"

const a = css(`
	.foobar {
		color: limegreen;
	}
`)
const A = () => <div className={`${a.foobar} ${styles.foobar}`}>Hello</div>

const b = css(`
	.yolo {
		color: pink;
	}
	.foobar {
		text-decoration: underline;
	}
`)
const B = () => <div className={b.yolo}>Bonjour</div>

const C = () => (
	<div
		className={inline`
			color: var(--color);
		`}
		style={{
			"--color": "purple",
		} as CSSProperties}
	>
		Hola
	</div>
)

export default function Foo() {
	console.log('in Foo', css`.michel { color: red; }`)
	return (
		<>
			<A />
			<B />
			<C />
		</>
	)
}