document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const statusMessage = document.getElementById('status-message');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const videoUrl = document.getElementById('video-url').value;
        const quality = document.querySelector('input[name="quality"]:checked').value;
        const noAudio = document.getElementById('no-audio').checked;
        
        statusMessage.textContent = 'Обработка запроса...';
        statusMessage.style.color = '#353839';
        
        try {
            const response = await fetch('/api/download.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: videoUrl,
                    quality: quality,
                    noAudio: noAudio
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }
            
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition 
                ? contentDisposition.split('filename=')[1].replace(/"/g, '')
                : 'video.mp4';
            
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            
            statusMessage.textContent = 'Видео успешно скачано!';
            statusMessage.style.color = 'green';
            
        } catch (error) {
            statusMessage.textContent = `Ошибка: ${error.message}`;
            statusMessage.style.color = 'red';
            console.error('Download error:', error);
        }
    });

});
