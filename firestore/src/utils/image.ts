import { Storage } from '@google-cloud/storage';
import moment from 'moment';
import jsdom from 'jsdom';
import stream from 'stream';

export async function uploadAndReplaceImageData(
  collectionId: string,
  params: Record<string, unknown>,
) {
  const data = {...params};
  const now = moment()
  const dateString = now.format('YYYY-MM-DD')
  const storage = new Storage();
  const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET);

  for (const [key, value] of Object.entries(data)) {
    if(typeof value === 'string') {
      let result = value as string;
      const doc = new jsdom.JSDOM(result)
      const images = doc.window.document.querySelectorAll('img')
      const imgSignature = /data:image\/\w+;base64,/

      for (let i = 0; i < images.length; i++) {
        const index = result.search(imgSignature)
        const srcIndex = images[i].getAttribute('src').search(imgSignature);
        if (srcIndex !== -1) {
          const timeText = moment().format('HH_mm_ss')
          const randomString = Math.random().toString(36).substring(5)
          // 8자리 랜덤 문자

          const imageData = images[i].getAttribute('src')
          const dataLength = imageData.length
          const dataSignature = imageData.split(',')[0];
          const base64Image = result.substring(
            index + dataSignature.length + 1,
            index + dataLength
          )
          const fileType = dataSignature.split(/(:|;)/)[2]
          const fileExtension = fileType.split('/')[1]

          // 이미지 업로드
          const bufferStream = new stream.PassThrough();
          bufferStream.end(Buffer.from(base64Image, 'base64'));
          const file = bucket.file(
            collectionId + '/' + dateString + '/'
              + randomString + '_' + timeText + '.' + fileExtension
          )
          await new Promise((resolve, reject) => {
            bufferStream.pipe(file.createWriteStream({
              metadata: {
                contentType: fileType,
                metadata: {
                  custom: 'metadata'
                }
              },
              public: true,
              validation: "md5"
            })).on('error', reject)
              .on('finish', resolve);
          });

          // 대치
          result = result.substring(0, index)
            + file.publicUrl()
            + result.substring(index + dataLength)

          data[key] = result;
        }
      }
    }
  }

  return data;
}
