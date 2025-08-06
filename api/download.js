const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { url, quality, noAudio } = req.body;
    
    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        console.log('Starting download process...');
        console.log('URL:', url);
        console.log('Quality:', quality);
        console.log('No Audio:', noAudio);
        
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-dlp-'));
        console.log('Temporary directory:', tempDir);
        
        // Формируем параметры
        let format = '';
        if (noAudio) {
            format = quality === 'best' ? 'bestvideo[ext=mp4]' : 'worstvideo[ext=mp4]';
        } else {
            format = quality === 'best' ? 'best[ext=mp4]' : 'worst[ext=mp4]';
        }

        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
        
        // Устанавливаем yt-dlp перед использованием
        console.log('Installing yt-dlp...');
        await execAsync('pip install yt-dlp', { timeout: 60000 });
        
        // Проверяем установку
        const { stdout: version } = await execAsync('yt-dlp --version');
        console.log('yt-dlp version:', version);
        
        // Команда для выполнения
        const command = `yt-dlp -f "${format}" -o "${outputTemplate}" "${url}"`;
        console.log('Executing command:', command);
        
        // Запускаем yt-dlp
        const { stdout, stderr } = await execAsync(command, { timeout: 300000 });
        console.log('stdout:', stdout);
        console.error('stderr:', stderr);

        // Ищем скачанный файл
        const files = fs.readdirSync(tempDir);
        if (files.length === 0) {
            throw new Error('No files downloaded');
        }

        const videoPath = path.join(tempDir, files[0]);
        console.log('Video path:', videoPath);
        
        // Проверяем размер файла
        const stats = fs.statSync(videoPath);
        const fileSize = stats.size;
        console.log('File size:', fileSize, 'bytes');
        
        if (fileSize > 50 * 1024 * 1024) {
            throw new Error('File size exceeds Vercel limit (50MB)');
        }

        // Определяем MIME-тип по расширению
        const ext = path.extname(videoPath).toLowerCase();
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.avi': 'video/x-msvideo'
        };
        
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        // Отправляем видео
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`);
        res.setHeader('Content-Length', fileSize);
        
        const videoStream = fs.createReadStream(videoPath);
        videoStream.pipe(res);
        
        // Удаляем файл после отправки
        videoStream.on('end', () => {
            try {
                fs.unlinkSync(videoPath);
                fs.rmdirSync(tempDir);
                console.log('Temporary files cleaned up');
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(error.message);
    }
};
