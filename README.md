# Total Viewer

PDF, Word(.docx), 한글(.hwp, .hwpx) 문서를 브라우저에서 바로 열어보는 뷰어입니다.
파일은 기기 안에서만 처리되며 서버로 전송되지 않습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 에 정적 파일 생성
```

## 지원 형식

| 형식 | 라이브러리 | 비고 |
|---|---|---|
| PDF | [pdf.js](https://github.com/mozilla/pdf.js) | |
| Word (.docx) | [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | 구형 .doc 미지원 |
| 한글 (.hwp) | [hwp.js](https://github.com/hahnlee/hwp.js) | 복잡한 레이아웃은 깨질 수 있음 |
| 한글 (.hwpx) | 자체 구현 | 글자·표 위주의 간략 표시 |

## 단축키

- `Ctrl + O` 파일 열기
- `Ctrl + +` / `Ctrl + -` 확대 / 축소
- `Ctrl + 0` 100%
