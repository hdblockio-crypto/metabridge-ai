// 1. 화면 요소(DOM) 가져오기
const imageInput = document.getElementById('imageInput');
const previewImage = document.getElementById('previewImage');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const convertBtn = document.getElementById('convertBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultText = document.getElementById('resultText');

let base64Image = null;

// 2. 이미지 파일 선택 시 미리보기 로직
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            previewImage.src = event.target.result;
            previewImage.style.display = 'block';
            uploadPlaceholder.style.display = 'none';
            base64Image = event.target.result; // 서버로 보낼 이미지 데이터 저장
            convertBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

// 3. AI 변환 버튼 클릭 이벤트
convertBtn.addEventListener('click', async () => {
    if (!base64Image) return;
    
    // 로딩 인디케이터 표시
    loadingOverlay.style.display = 'flex';
    resultText.textContent = 'AI가 이미지를 분석 중입니다...';

    try {
        // [중요] 우리 서버(Back-end)에게 데이터 전달
        const response = await fetch('http://localhost:3000/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });

        const data = await response.json();

        if (data.success) {
            // 성공 시 결과 출력 (서버에서 보내준 데이터를 보여줌)
            resultText.textContent = JSON.stringify(data.result, null, 2);
            console.log("분석 완료:", data.result);
        } else {
            alert("분석 중 오류가 발생했습니다: " + data.error);
        }
    } catch (error) {
        console.error("통신 에러:", error);
        alert("서버와 연결할 수 없습니다. 서버(node server.js)가 켜져 있는지 확인하세요.");
    } finally {
        loadingOverlay.style.display = 'none';
    }
});