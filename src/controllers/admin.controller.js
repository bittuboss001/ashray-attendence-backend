import { User } from "../models/user.model.js";
import { Student } from "../models/Student.model.js";
import { StaffAttendance } from "../models/StaffAttendance.model.js";
import { StudentAttendance } from "../models/StudentAttendance.model.js";
import { Class } from "../models/class.model.js";
import moment from "moment-timezone";
import { uploadOnCloudinary,deletePhoto } from "../utils/cloudinary.js";

// Register new staff
export const registerStaff = async (req, res) => {
    try {
        const { name, role, email, password, classId } = req.body;
        const file = req.files?.photo?.[0];
         
// Check if the user already exists
const existingUser = await User.findOne({ email });
if (existingUser) {
    return res.status(400).json({ message: "Staff with this email already exists" });
}


      let photoUrl = null;
       // Upload photo to S3
        // if (file) {
        //     photoUrl = await uploadToS3(file.path, "staff_photos");
        // }

        //upload on cloudinary
        if (file) {
            photoUrl = await uploadOnCloudinary(file.path, "staff_photos");
        }
        else{
            photoUrl = "https://res.cloudinary.com/dxkufsejm/image/upload/v1633666824/blank-profile-picture-973460_640_ewvz9d.png"
        }
  
        

        const staff = await User.create({
            name,
            role,
            email,
            password,
            photo: photoUrl,
            class: classId,
        });

        res.status(201).json({ message: "Staff registered successfully", staff });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Register new student
export const registerStudent = async (req, res) => {
    try {
        const { name, uid, fatherPhone, aadharNumber, address, classId } = req.body;
        const file = req.files?.photo?.[0];
         
        const existingStudent = await Student.findOne({ uid });
        if (existingStudent) {
            return res.status(400).json({ message: "student with this uid already exists" });
        }

        let photoUrl = null;
       // Upload photo to S3
        // if (file) {
        //     photoUrl = await uploadToS3(file.path, "staff_photos");
        // }

        //upload on cloudinary
        if (file) {
            photoUrl = await uploadOnCloudinary(file.path, "student_photos");
        }

        const newStudent = await Student.create({
            name,
            uid,
            fatherPhone,
            address,
            aadharNumber,
            photo: photoUrl,
            class: classId,
        });
        await Class.findByIdAndUpdate(
            classId,
            { $push: { students: newStudent._id } }, // Push the student's ID into the Class's students array
            { new: true }
          );

        res.status(201).json({ message: "Student registered successfully", newStudent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all students
export const allStudents = async (req, res) => {
    try {
        const students = await Student.find().populate("class", "name");
        res.status(200).json({ students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all staff
export const allStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: { $ne: "admin" } }).populate("class", "name"); 
        res.status(200).json({ staff });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateStaff = async (req, res) => {
    try {
      const { id,name,phone,password } = req.body;
      console.log(id,name,phone,password);
      if (!id) return res.status(400).json({ message: "Staff ID is required" });
      // Validate and parse updates
      //fetch staff member before updating
      const staffMember = await User.findById(id);
      if (!staffMember) return res.status(404).json({ message: "Staff not found" });

      let updateFields = {};
      if (name && name !== staffMember.name) updateFields.name = name;
      if (phone && phone !== staffMember.phone) updateFields.phone = phone;
      if (!password == "") updateFields.password = password;

      // Handle photo upload
      if (req.files?.photo?.[0]) {
        const file = req.files.photo[0];
        const filePath = file.path;
        console.log(filePath)
        let photoUrl = null;
        // Upload to Cloudinary
        if (filePath) {
            photoUrl = await uploadOnCloudinary(file.path, "staff_photos");
            console.log(photoUrl)
            updateFields.photo=photoUrl;
            console.log(updateFields.photo)
        }
      }
           // Delete the old photo from Cloudinary
      if (staffMember.photo) {
        const oldPhotoUrl = staffMember.photo;
        const publicId = oldPhotoUrl
          .split("/")
          .slice(-2)
          .join("/")
          .replace(".jpg", "")
          .replace(".png", "")
          .replace(".jpeg", "");
         
        await deletePhoto(publicId);
      }

      // Update the staff record in the database
      const updatedStaff = await User.findByIdAndUpdate(id, updateFields, { new: true });
      if (!updatedStaff) return res.status(404).json({ message: "Staff not found" });
  
      res.status(200).json({
        message: "Staff updated successfully",
        
      });
    } catch (error) {
      console.error("Error updating staff:", error);
      res.status(500).json({ error: error.message });
    }
  };

// Update student
export const updateStudent = async (req, res) => {
    try {
        const { id, updates } = req.body;
        const updatedStudent = await Student.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedStudent) return res.status(404).json({ message: "Student not found" });
        res.status(200).json({ message: "Student updated successfully", updatedStudent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete staff
export const deleteStaff = async (req, res) => {
    try {
        const { id } = req.body;
        const deletedStaff = await User.findByIdAndDelete(id);
        if (!deletedStaff) return res.status(404).json({ message: "Staff not found" });
        res.status(200).json({ message: "Staff deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete student
export const deleteStudent = async (req, res) => {
    try {
        const { id } = req.body;
        const deletedStudent = await Student.findByIdAndDelete(id);
        if (!deletedStudent) return res.status(404).json({ message: "Student not found" });
        res.status(200).json({ message: "Student deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get today's attendance for staff
export const todayAttendanceStaff = async (req, res) => {
    try {
        // Get today's date in IST (format YYYY-MM-DD)
        const todayDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

        // Find attendance records for today
        const attendance = await StaffAttendance.find({
            date: todayDate,
            checkInTime: { $ne: null }, // Only records with check-in time
        }).populate('user', 'name role email'); // Populate user details (name, role, email)

        res.status(200).json({ attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get today's attendance for students
export const todayAttendanceStudents = async (req, res) => {
    try {
        const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
        const attendance = await StudentAttendance.find({ date: today })
  .populate('studentId', 'name')
  .populate('markedBy', 'name');
  
        res.status(200).json({ attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get attendance history for staff
export const getStaffAttendanceById = async (req, res) => {
    const { staffId } = req.params;
     
    try {
      const attendanceData = await StaffAttendance.find({ user: staffId })
        .populate('user', 'name') // Populate the 'name' field from the User model
        .select('date checkInTime checkOutTime isForgottenCheckout') // Select specific fields to return
        .lean(); // Convert Mongoose documents to plain JavaScript objects
          

        console.log(attendanceData);
      if (!attendanceData || attendanceData.length === 0) {
        return res.status(404).json({ message: 'No attendance data found for the given staff' });
      }
  
      // Format response to include only the required fields
      const formattedData = attendanceData.map((entry) => ({
        name: entry.user.name,
        date: entry.date,
        checkInTime: entry.checkInTime,
        checkOutTime: entry.checkOutTime,
      }));
  
      res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
      console.error('Error fetching staff attendance:', error);
      res.status(500).json({ message: 'Failed to fetch attendance data', error: error.message });
    }
  };

// Get attendance history for students
export const getStudentAttendanceById = async (req, res) => {
    const { studentId } = req.params;
  
    try {
      // Fetch attendance data and populate the student name and markedBy (staff name)
      const attendanceData = await StudentAttendance.find({ studentId })
        .populate('studentId', 'name') // Populate the 'name' field from the Student model
        .populate('markedBy', 'name') // Populate the 'name' field of the user who marked the attendance
        const attendanceDataStudent = await StudentAttendance.find({ studentId })
      .populate('studentId', 'name') 
      .populate('markedBy', 'name') 
      .select('date status markedBy') 
      .lean(); // Convert Mongoose documents to plain JavaScript objects
       console.log(attendanceDataStudent)
      // If no attendance data found
      if (!attendanceDataStudent || attendanceDataStudent.length === 0) {
        return res.status(404).json({ message: 'No attendance data found for the given student ID' });
      }
  
      const formattedData = attendanceDataStudent.map((entry) => ({
        studentName: entry.studentId.name,
        date: entry.date,
        status: entry.status,
        markedBy: entry.markedBy.name,
      }));
       
      res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
      console.error('Error fetching student attendance:', error);
      res.status(500).json({ message: 'Failed to fetch attendance data', error: error.message });
    }
  };

//create class
export const createClass = async (req, res) => {
    try {
      const { name, description } = req.body;
   
      // Validate input
      if (!name) {
        return res.status(400).json({ message: 'Class name is required.' });
      }
  
      // Check if a class with the same name already exists
      const existingClass = await Class.findOne({ name });
      if (existingClass) {
        return res.status(400).json({ message: 'Class with this name already exists.' });
      }
  
      // Create the class
      const newClass = new Class({
        name,
        description,
      });
  
      // Save the class to the database
      await newClass.save();
  
      res.status(201).json({
        message: 'Class created successfully.',
        class: newClass,
      });
    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
  };
//get all class
export const getAllClasses = async (req, res) => {
    try {
      const classes = await Class.find({}, 'name _id'); // Fetch only `name` and `_id` fields
      res.status(200).json({ classes });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };