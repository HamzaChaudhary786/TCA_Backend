// body of the request for usertype student with sample values
// {
//   "name": "John Doe",
//   "email": "mustafa@gmail.com"
//   "password": "password",
//   "userType": "student",
//   "phoneNumber": "08012345678",
//   "levelID": "60f8e2d3d6d2e3a7f8e7b4c3",
//   "guardianName": "Jane Doe",
//   "guardianEmail": "
//   "guardianPhoneNumber": "08012345678"
// }

// body of the request for usertype teacher with sample values
// {
//   "name": "John Doe",
//   "email": "mustafa@gmail.com"
//   "password": "password",
//   "userType": "teacher",
//   "phoneNumber": "08012345678",
//   "qualification": "Bsc in Computer Science",
//   "cv": "https://www.linkedin.com/in/mustafa-olagunju-0b0a0a1b3/"
// }

//body of request for creating class
// {
//   "title": "Mathematics",
//   "startTime": "12:00",
//   "endTime": "1:00",
//   "createdBy": "65cca963369c0c7117b5e3e9",
//   "oneTime": false,
//   "classroomID": "60f8e2d3d6d2e3a7f8e7b4c3",
//   "subjectID": "60f8e2d3d6d2e3a7f8e7b4c3",
//   "teacher": {
//     "teacherID": "60f8e2d3d6d2e3a7f8e7b4c3",
//     "status": "present"
//   },

//body of request for creating classroom
// {
//   "name": "JSS1",
//   "levelID": "60f8e2d3d6d2e3a7f8e7b4c3"
// "students": ["65cca62592627624bc2858ba","65cca63392627624bc2858bd"],
// "teachers": [
//   {
//     "teacher": "65cca68c9747c80928061e71",
//     "subject": "65ccaae6fc6ffe2ac4fe3f88"
//   },
//   {
//     "teacher": "65cca69f9747c80928061e74",
//     "subject": "65ccaadefc6ffe2ac4fe3f82"
//   }
// }

//body of request for creating subject
// {
//   "name": "Mathematics",
// }

//body of request for creating class
// {
//   "title": "this is topic",
//   "startTime": "2024-02-17T08:30:13.386+00:00",
//   "endTime": "2024-02-17T10:00:13.386+00:00",
//   "oneTime": false,
//   "classroomID": "65ccabc2d3cc7640040baab4",
//   "subjectID": "65ccaae6fc6ffe2ac4fe3f88",
//   "teacher": {
//     "teacherID": "65cca68c9747c80928061e71",
//     "status": "present"
//   },
// }

//body of request to reschedule class
// {
//   "title": "this is topic",
//   "startTime": "2024-02-17T08:30:13.386+00:00",
//   "endTime": "2024-02-17T10:00:13.386+00:00",
//   "oneTime": false,
//   "classroomID": "65ccabc2d3cc7640040baab4",
//   "subjectID": "65ccaae6fc6ffe2ac4fe3f88",
//   "teacher": {
//     "teacherID": "65cca68c9747c80928061e71",
//     "status": "present"
//   },
// }

//body of request to create assignment
// {
//   "title": "this is title",
//   "totalMarks": 100,
//   "dueDate": "2024-02-17T08:30:13.386+00:00",
//   "files": ["file1", "file2"],
//   "classroomID": "65ccabc2d3cc7640040baab4"
// }

//body request to submit assignment
// {
//   "file": "file1"
// }
