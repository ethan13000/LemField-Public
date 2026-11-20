'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const crcTable=Array.from({length:256},(_,index)=>{let value=index;for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
const crc32=buffer=>{let crc=0xffffffff;for(const value of buffer)crc=crcTable[(crc^value)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
function zipPackage(plan){
 const local=[],central=[];let offset=0;
 for(const entry of plan.entries){
  const name=Buffer.from(entry.name),raw=fs.readFileSync(entry.file),compressed=zlib.deflateRawSync(raw),crc=crc32(raw),header=Buffer.alloc(30),directory=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26);
  directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(8,10);directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(raw.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
  local.push(header,name,compressed);central.push(directory,name);offset+=header.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(plan.entries.length,8);end.writeUInt16LE(plan.entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);fs.writeFileSync(plan.zip,Buffer.concat([...local,directory,end]));
 const bytes=fs.readFileSync(plan.zip);let cursor=0;
 for(const entry of plan.entries){assert.equal(bytes.readUInt32LE(cursor),0x04034b50);const packed=bytes.readUInt32LE(cursor+18),size=bytes.readUInt32LE(cursor+22),length=bytes.readUInt16LE(cursor+26),extra=bytes.readUInt16LE(cursor+28),name=bytes.subarray(cursor+30,cursor+30+length).toString();assert.equal(name,entry.name);const start=cursor+30+length+extra,raw=zlib.inflateRawSync(bytes.subarray(start,start+packed));assert.equal(raw.length,size);assert.equal(crc32(raw),bytes.readUInt32LE(cursor+14));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);cursor=start+packed;}
 assert.equal(cursor,offset);assert.equal(bytes.readUInt32LE(cursor),0x02014b50);console.log(plan.target+': verified '+plan.entries.length+' ZIP files: '+plan.zip);
}


module.exports={zipPackage};
