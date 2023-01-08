const User = require('../models/userModel');
const factory = require('../controllers/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const cloudinary = require('../utils/cloudinary');

//

exports.getAllUser = factory.getAll(User);
exports.createUser = catchAsync(async (req, res, next) => {
  const { googleId } = req.body;
  console.log('req.body', req.body);

  User.findOne(
    {
      googleId,
    },
    async (err, user) => {
      if (err) {
        console.log('err', err);
      }
      if (!user) {
        await User.create(req.body);
      } else {
        console.log('Người dùng đã tồn tại!');
      }
    }
  );
});
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
exports.getDetailUser = factory.getOne(User);

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/img/users');
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(
      new AppError('Không phải hình ảnh! Vui lòng tải file hình ảnh.', 400),
      false
    );
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadUserPhoto = upload.single('avatar');

const filterObj = (obj, ...allowedField) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedField.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    user,
  });
};

// exports.updateUser = factory.updateOne(User);

exports.updateMe = catchAsync(async (req, res, next) => {
  // 2) Update user document
  // Get filtered name and email
  const filteredBody = filterObj(
    req.body,
    'displayName',
    'phoneNumber',
    'gender',
    'dateOfBirth',
    'photoURL'
  );

  const uploadedResponse = await cloudinary.uploader.upload(
    filteredBody.photoURL,
    {
      upload_preset: 'profile',
    }
  );
  filteredBody.photoURL = uploadedResponse.secure_url;

  const user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    status: 'success',
    result: user.length,
    data: user,
  });
});

exports.getUserLoginGoogle = catchAsync(async (req, res, next) => {
  const { googleId } = req.body;
  let user = await User.findOne({ googleId });
  if (!user) {
    return next(new AppError('Người dùng không tồn tại!', 401));
  } else {
    createSendToken(user, 200, res);
  }
});
