float q,n=4,r;
void setup()
{
  size(screen.width/2, screen.height/2);
  smooth();
  if(screen.width/2 > screen.height/2) r = screen.height/2;
  else r = screen.width/2;
  ellipse(screen.width/4, screen.height/4,r/2,r/2);
}

void draw()
{
  makeLine(screen.width/4, screen.height/4,200*cos(calcQ()*3.14/180)+screen.width/4,200*sin(calcQ()*3.14/180)+screen.height/4);
 // stroke(255);
  stroke(204, 102, 0);
  makeLine(screen.width/4, screen.height/4,200*cos(calcQ()*3.14/360)+screen.width/4,200*sin(calcQ()*3.14/360)+screen.height/4);
  stroke(0);
  //delay(50);
}

void makeLine(float x0,float y0,float x1,float y1)
{
  line(x0,y0,x1,y1);
}

float calcQ()
{
  n+=0.2;
  return q+=(360/n);
}
