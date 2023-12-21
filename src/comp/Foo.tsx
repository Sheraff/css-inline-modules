import { css, inline } from "./css"

const a = css(`
	.foobar {
		color: limegreen;
	}
`)
const A = () => <div className={a.foobar}>Hello</div>

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
			color: purple;
		`}
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