const camera_button = document.querySelector("#start-camera");
const video = document.querySelector("#video");
const click_button = document.querySelector("#click-photo");
const canvas = document.querySelector("#canvas");
let image_data_url;
const imgurl = document.getElementById('imgurl');
const SaveBtn = document.getElementById('save');

camera_button.addEventListener('click', async function() {
   	try{
		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
		video.srcObject = stream;
		click_button.style.display = "block"
	}catch(err){M.toast({html: "<strong style='color: #c23934'>Camera not found</strong>",classes: 'rounded'});}
});

click_button.addEventListener('click', function() {
   	canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
   	image_data_url = canvas.toDataURL('image/jpeg');
	imgurl.value = image_data_url;
	SaveBtn.style.display = "block";
});


