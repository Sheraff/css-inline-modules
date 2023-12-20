import classes from './Foo.module.css'
import { css } from "./css"

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

export default function Foo() {
	return (
		<>
			<A />
			<B />
		</>
	)
}