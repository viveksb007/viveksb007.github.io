void setup() {
  size(screen.width/2, screen.height/2);
  smooth();
}

x=10;
void draw() {

  for (int i=1; i<20; i++)
  {
    stroke(10*i);
    fill(255-10*i);
    ellipse(10*x-100, i*20+15*sin(x), 1, 1);
  }
  x+=0.1;
}

