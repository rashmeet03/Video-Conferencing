import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";

// In-memory storage for users to replace MongoDB entirely
const users = [];

const login = async(req,res)=>{
    const {username,password} = req.body;

    if(!username || !password) return res.status(400).json({message:"Please Provide username and password"});
    
    try{
        const user = users.find(u => u.username === username);
        if(!user){
            return res.status(httpStatus.NOT_FOUND).json({message:"User not found"});
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(isMatch){
            let token = crypto.randomBytes(20).toString("hex");
            user.token = token;
            return res.status(httpStatus.OK).json({token:token});
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({message:"Invalid Password"});
        }
    }catch(e){
        return res.status(500).json({message:`Something went wrong ${e}`});
    }
}

const register = async(req,res)=>{
    const {name,username,password} = req.body;

    try{
        const existinguser = users.find(u => u.username === username);
        if(existinguser) return res.status(httpStatus.FOUND).json({message:"User already exists"});
        
        const hashedPassword = await bcrypt.hash(password,10);
        
        const newUser = {
            id: Date.now().toString(),
            name: name,
            username: username,
            password: hashedPassword,
            token: ""
        };

        users.push(newUser);
        res.status(httpStatus.CREATED).json({message:"User Registered"});
    }catch(e){
        res.status(500).json({message:`Something went wrong ${e}`});
    }
}

export {login,register};