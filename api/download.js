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
        
        // ИСПРАВЛЕННЫЕ ПУТИ - теперь правильные
        const baseDir = path.join(__dirname, '..', 'yt-dlp');
        const ytDlpPath = path.join(baseDir, 'yt-dlp.exe');
        const ffmpegPath = path.join(baseDir, 'ffmpeg.exe');
        
        console.log('yt-dlp Path:', ytDlpPath);
        console.log('ffmpeg Path:', ffmpegPath);
        
        // Проверка существования бинарников
        if (!fs.existsSync(ytDlpPath)) {
            throw new Error(`yt-dlp.exe not found at ${ytDlpPath}`);
        }
        if (!fs.existsSync(ffmpegPath)) {
            throw new Error(`ffmpeg.exe not found at ${ffmpegPath}`);
        }
        
        // Формируем параметры
        let format = '';
        if (noAudio) {
            format = quality === 'best' ? 'bestvideo' : 'worstvideo';
        } else {
            format = quality === 'best' ? 'bestvideo+bestaudio' : 'worstvideo+worstaudio/worst';
        }

        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
        
        // Команда для выполнения
        const command = `"${ytDlpPath}" -f "${format}" --ffmpeg-location "${path.dirname(ffmpegPath)}" --remux-video mp4 -o "${outputTemplate}" "${url}"`;
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

        // Отправляем видео
        res.setHeader('Content-Type', 'video/mp4');
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
