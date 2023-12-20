# CSS inline modules

Write CSS Modules inside your TSX files
```tsx
const b = css(`
	.yolo {
		color: pink;
	}
	.foobar {
		text-decoration: underline;
	}
`)
const B = () => <div className={b.yolo}>Bonjour</div>
```